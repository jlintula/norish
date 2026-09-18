# 09 — ADRs accepted, glossary settled, the WebSocket configuration page, release notes

**What to build:** the paperwork that makes the rebuild a recorded decision and a documented feature.

- Flip the three entries for ADR-0032, ADR-0033 and ADR-0034 in `docs/adr/index.html` from **Proposed.** to **Accepted.**; re-read the ADR bodies in `docs/adr/realtime/` against what shipped and correct any detail that drifted (bounds, close codes, file names).
- Re-read the `### Realtime` section of `CONTEXT.md` against the code; every term must name something that exists.
- Write `apps/docs/docs/configuration/websocket.md`: the endpoint (`/trpc` upgrade on the HTTP port; only subscriptions use it); reverse-proxy examples for nginx (`proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 60s;`), Caddy (`reverse_proxy` handles it by default) and Traefik (no extra configuration), with the rule that any idle timeout must exceed 25 s because the server pings every 20 s and waits 5 s for the pong; the Origin check and `TRUSTED_ORIGINS`; the close codes (`1012` restart, `4000` scope change, `4401` sign in again); Redis expectations (the connection count is independent of connected clients; `norish:stream:*` keys hold about a thousand recent events per channel for a day); troubleshooting (the banner line, the `realtime.reconnected` log). Link it from `apps/docs/docs/configuration/server-runtime.md` beside `REDIS_URL`.
- Release notes for the Target Version (`apps/docs/docs/release-notes/<target>.md`, per `docs/agents/feature-docs.md`): under Fixes and Improvements, one bullet for missed events arriving after a reconnect and one for the faster restart; under Upgrade notes, the Origin check (an operator whose proxy rewrites `Origin` must list the public origin in `TRUSTED_ORIGINS`) and that the mobile app is parked and unsupported on this release until its rewrite ships.
- `pnpm format` and `pnpm build` inside `apps/docs` (a standalone workspace).

**Blocked by:** 07, 08.

**Spec:** `.scratch/realtime-foundation/spec.md` § Release shape

**Status:** ready-for-agent

- [ ] Index entries read **Accepted.**; ADR bodies match the shipped code
- [ ] `CONTEXT.md` `### Realtime` verified against the code
- [ ] `websocket.md` in the docs sidebar; `server-runtime.md` links it
- [ ] Release notes updated: two improvement bullets, two upgrade notes
- [ ] `pnpm format` and `pnpm build` in `apps/docs` green; the four root gates green

## Comments
