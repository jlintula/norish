import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as wsModule from "ws";

import { getVerifiedSession } from "@norish/auth/session";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { trpcLogger } from "@norish/shared-server/logger";

import {
  registerConnection,
  startConnectionInvalidation,
  unregisterConnection,
} from "./connection-manager";
import { createWsContext } from "./context";
import { appRouter } from "./router";

// Extend IncomingMessage to include connectionId
declare module "node:http" {
  interface IncomingMessage {
    connectionId?: string;
  }
}

// ws exports differ between ESM (named exports) and CJS (default export with Server)
const wsInterop = wsModule as unknown as {
  WebSocketServer?: typeof wsModule.WebSocketServer;
  Server?: typeof wsModule.WebSocketServer;
  default?: { Server?: typeof wsModule.WebSocketServer };
};
const resolvedWsServer = wsInterop.WebSocketServer ?? wsInterop.Server ?? wsInterop.default?.Server;

if (!resolvedWsServer) {
  throw new Error("ws module does not export a WebSocket server constructor");
}

const WsServer = resolvedWsServer;

type WsServerType = InstanceType<typeof WsServer>;

// Use globalThis to survive HMR in development
const globalForWs = globalThis as unknown as {
  trpcWss: WsServerType | null;
  trpcHandler: ReturnType<typeof applyWSSHandler> | null;
  stopConnectionInvalidation: (() => void) | null;
};

let trpcWss = globalForWs.trpcWss ?? null;
let trpcHandler = globalForWs.trpcHandler ?? null;
let stopConnectionInvalidation = globalForWs.stopConnectionInvalidation ?? null;

export function initTrpcWebSocket(server: Server) {
  if (trpcWss) {
    trpcLogger.warn("WebSocket server already initialized");

    return;
  }

  trpcWss = new WsServer({ noServer: true });
  globalForWs.trpcWss = trpcWss;

  trpcHandler = applyWSSHandler({
    wss: trpcWss,
    router: appRouter,
    createContext: createWsContext,
    keepAlive: {
      enabled: true,
      pingMs: 20000, // Send ping every 20 seconds
      pongWaitMs: 5000, // Wait 5 seconds for pong before closing
    },
  });
  globalForWs.trpcHandler = trpcHandler;

  server.on("upgrade", async (req, socket, head) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    trpcLogger.trace({ pathname: url.pathname, host }, "WebSocket upgrade request");

    // Only handle /trpc WebSocket path
    if (url.pathname !== "/trpc") {
      // In development, let Next.js HMR handle other WebSocket paths
      // In production, reject unknown WebSocket upgrades to prevent socket leaks
      if (SERVER_CONFIG.NODE_ENV !== "development") {
        trpcLogger.debug({ pathname: url.pathname }, "Rejecting non-tRPC WebSocket upgrade");
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }

      return;
    }

    // Pre-authenticate to get userId for connection tracking
    const headers = new Headers();

    if (req.headers.cookie) headers.set("cookie", String(req.headers.cookie));
    if (req.headers["x-api-key"]) headers.set("x-api-key", String(req.headers["x-api-key"]));

    let userId: string | undefined;

    try {
      const identity = await getVerifiedSession(headers);

      if (!identity) {
        throw new Error("No session");
      }
      userId = identity.id;
    } catch {
      trpcLogger.debug("Rejecting unauthenticated WebSocket connection");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();

      return;
    }

    trpcWss!.handleUpgrade(req, socket, head, (ws: wsModule.WebSocket) => {
      const connectionId = randomUUID();

      req.connectionId = connectionId;
      trpcLogger.trace({ userId, connectionId }, "WebSocket connection established");

      // Track connection by userId for server-side termination
      if (userId) {
        registerConnection(userId, ws);
        ws.on("close", () => {
          try {
            unregisterConnection(userId, ws);
          } catch (err) {
            trpcLogger.error({ err, userId }, "Failed to unregister WebSocket connection");
          }
        });
      }

      trpcWss!.emit("connection", ws, req);
    });
  });

  // Scope Changes announced by any process close this one's sockets (ADR-0033).
  // The hub is started before the HTTP server, so the registration is immediate.
  try {
    stopConnectionInvalidation = startConnectionInvalidation();
    globalForWs.stopConnectionInvalidation = stopConnectionInvalidation;
  } catch (err) {
    trpcLogger.error({ err }, "Failed to start invalidation listener");
  }

  server.on("close", () => {
    trpcHandler?.broadcastReconnectNotification();
    stopConnectionInvalidation?.();
    trpcWss?.close();

    trpcWss = null;
    trpcHandler = null;
    stopConnectionInvalidation = null;
    globalForWs.trpcWss = null;
    globalForWs.trpcHandler = null;
    globalForWs.stopConnectionInvalidation = null;
  });

  trpcLogger.info("WebSocket server started at /trpc");
}
