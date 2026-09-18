# 06 — Connection lifecycle: one auth, an Origin check, 4401, an awaited shutdown

**What to build:** `packages/trpc/src/ws-server.ts` authenticates once, refuses foreign origins, tells an unauthenticated client so with a close code, and shuts down in seconds.

- The `upgrade` handler already calls `getVerifiedSession` (`:100-113`); it stores the resulting `User` on `req.realtimeIdentity` (extend the existing `declare module "node:http"` block at `:20-24`) and `createWsContext` in `packages/trpc/src/context.ts:106-141` builds the context from that instead of calling `getVerifiedSession` a second time. The WS context drops `operationId`: only subscriptions travel over the socket (`packages/shared-react/src/providers/trpc-links.ts:290-299` routes everything else over HTTP), so no mutation ever runs on it.
- An `Origin` header, when present, must match the origin of `SERVER_CONFIG.AUTH_URL`, an entry of `SERVER_CONFIG.TRUSTED_ORIGINS` (`packages/config/src/env-config-server.ts:93`), or `${scheme}://${host}` of the request; otherwise write `HTTP/1.1 403 Forbidden` and destroy the socket. An absent `Origin` (native clients, `curl`) is accepted.
- An unauthenticated upgrade completes the WebSocket handshake and is then closed with code **4401** and reason `Unauthorized`, replacing the raw `401` write at `:109-110`, so the client can distinguish "sign in again" from "server unreachable" by code alone.
- Export `stopTrpcWebSocket(): Promise<void>`: `trpcHandler.broadcastReconnectNotification()`, close every client with **1012** and reason `Service Restart`, `await` `wss.close()`, clear the `globalThis` handles. Replace the never-awaited `server.on("close", async …)` handler at `:137-146` with an awaited call from `packages/api/src/startup/shutdown.ts` placed right after the HTTP server closes; live sockets no longer hold `server.close()` open, so the 30 s timeout path stops firing on every deploy.
- `unregisterConnection` in `connection-manager.ts` becomes synchronous and the `ws.on("close")` handler at `ws-server.ts:125` wraps it in try/catch, so it can no longer produce an unhandled rejection.
- Keep-alive stays `pingMs: 20000`, `pongWaitMs: 5000`.

**Blocked by:** 05.

**Spec:** `.scratch/realtime-foundation/spec.md` § Connection lifecycle

**Status:** ready-for-agent

- [ ] `packages/trpc/__tests__/ws-server.test.ts` drives `server.emit("upgrade", req, socket, head)` with a fake socket and a spied `getVerifiedSession`: exactly one verification per connection
- [ ] Origin cases in that test: mismatched → `403` and destroyed; matches `AUTH_URL` → accepted; matches a `TRUSTED_ORIGINS` entry → accepted; matches the host → accepted; absent → accepted
- [ ] Unauthenticated → handshake completes, then close `4401`
- [ ] `stopTrpcWebSocket` sends `1012` to every open socket and resolves; `shutdown.ts` awaits it right after HTTP close and the `server.on("close")` handler is gone
- [ ] `ws.on("close")` cannot reject
- [ ] `Context` has no `operationId` on the WS path; the HTTP path is unchanged
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments
