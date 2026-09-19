---
sidebar_position: 5
title: WebSocket & realtime
description: The WebSocket endpoint, reverse-proxy settings, the Origin check, close codes, and what realtime needs from Redis.
---

# WebSocket & realtime

Norish keeps every open browser tab in sync over one WebSocket per tab: a
grocery a housemate adds appears on your list without a reload. This page is
for operators running Norish behind a reverse proxy, and for anyone reading the
server log when realtime does not behave.

## The endpoint

The WebSocket is an HTTP `Upgrade` on the **same port** as the app, at the path
`/trpc`. There is no second port to publish. Only realtime subscriptions travel
over the socket; every query and mutation is an ordinary HTTP request.

The startup banner prints the exact address the server serves:

```text
  WS:   ws://0.0.0.0:3000/trpc
```

## Reverse proxies

A proxy must forward the `Upgrade` handshake and must not cut an idle socket.
The server sends a ping every **20 seconds** and closes the connection when the
pong takes more than **5 seconds**, so any idle or read timeout on the proxy
must be **longer than 25 seconds**. Shorter than that, the proxy drops the
socket between pings and clients reconnect in a loop.

### nginx

```nginx
location / {
    proxy_pass http://norish:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### Caddy

```caddyfile
norish.example.com {
    reverse_proxy norish:3000
}
```

Caddy's `reverse_proxy` forwards WebSocket upgrades by default and has no idle
timeout of its own.

### Traefik

No extra configuration: Traefik forwards WebSocket upgrades on any HTTP router.
If you set responding timeouts on the entrypoint, keep them above 25 seconds.

## The Origin check

A browser sends an `Origin` header with the upgrade request. Norish accepts the
socket only when that origin is one of:

- the origin of `AUTH_URL`,
- an entry of `TRUSTED_ORIGINS`,
- the host the request arrived on (under `http` or `https`).

Anything else is refused with `403 Forbidden` before the handshake, so a page on
a foreign site cannot ride your browser's session cookie onto your instance.
A request without an `Origin` header (native clients, `curl`) is accepted.

If your proxy rewrites `Origin`, or Norish is reached under a name that is
neither `AUTH_URL` nor the request host, list the public origin in
`TRUSTED_ORIGINS` — see [Server & runtime](./server-runtime.md#networking--origins).

## Close codes

The server closes a socket with a code that says why. The web app acts on the
code alone, so these are worth knowing when reading a browser's network tab or
the server log.

| Code   | Meaning                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1012` | **Service restart.** The server is shutting down. Every client is told so, reconnects with backoff once the server is back, and receives the events it missed.                      |
| `4000` | **Scope change.** The user created, joined or left a household, was kicked, or changed admin. Every subscription restarts against the new household; the client reconnects at once. |
| `4401` | **Sign in again.** The session is expired or invalid. The client stops reconnecting and sends the user to the sign-in page rather than retrying forever.                            |

## What realtime needs from Redis

Norish publishes realtime events through Redis, which is why `REDIS_URL` is
required.

- **Connections do not grow with clients.** The server holds one Redis
  subscriber connection per process, plus its publisher and the job queue's
  connections, whatever the number of connected browsers.
- **A short buffer of recent events.** Every published event is also appended
  to a Redis Stream named `norish:stream:*`, one per channel. Each stream keeps
  about a thousand recent events and disappears a day after its last event. A
  client that reconnects within that window receives what it missed, in order,
  before going live; a client away longer refetches its lists instead. These
  streams are small and need no maintenance.
- **A Redis restart is survivable.** The server reconnects on its own and tells
  every connected client to refetch.

## Troubleshooting

- **Realtime does not work behind the proxy.** Check that the proxy forwards
  the `Upgrade` and `Connection` headers and that its idle timeout is longer
  than 25 seconds (see above). The banner line `WS:   ws://…/trpc` shows the
  path the server serves; the proxy must pass that path through unchanged.
- **The browser's socket closes with `403`.** The page's origin failed the
  Origin check. Add the public origin to `TRUSTED_ORIGINS`.
- **The log says `realtime.reconnected`.** The server's Redis connection
  dropped and came back. The line lists the channels that were live; every
  connected client refetches and carries on. One such line during a Redis
  restart is expected. Repeated lines mean Redis is unstable.
- **Clients reconnect in a loop.** Something between the browser and the server
  closes idle sockets. Raise the proxy's idle timeout above 25 seconds.
