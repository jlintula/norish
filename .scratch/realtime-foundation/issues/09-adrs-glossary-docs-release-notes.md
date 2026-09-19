# 09 — ADRs accepted, glossary settled, the WebSocket configuration page, release notes

**What to build:** the paperwork that makes the rebuild a recorded decision and a documented feature.

- Flip the three entries for ADR-0032, ADR-0033 and ADR-0034 in `docs/adr/index.html` from **Proposed.** to **Accepted.**; re-read the ADR bodies in `docs/adr/realtime/` against what shipped and correct any detail that drifted (bounds, close codes, file names).
- Re-read the `### Realtime` section of `CONTEXT.md` against the code; every term must name something that exists.
- Write `apps/docs/docs/configuration/websocket.md`: the endpoint (`/trpc` upgrade on the HTTP port; only subscriptions use it); reverse-proxy examples for nginx (`proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 60s;`), Caddy (`reverse_proxy` handles it by default) and Traefik (no extra configuration), with the rule that any idle timeout must exceed 25 s because the server pings every 20 s and waits 5 s for the pong; the Origin check and `TRUSTED_ORIGINS`; the close codes (`1012` restart, `4000` scope change, `4401` sign in again); Redis expectations (the connection count is independent of connected clients; `norish:stream:*` keys hold about a thousand recent events per channel for a day); troubleshooting (the banner line, the `realtime.reconnected` log). Link it from `apps/docs/docs/configuration/server-runtime.md` beside `REDIS_URL`.
- Release notes for the Target Version (`apps/docs/docs/release-notes/<target>.md`, per `docs/agents/feature-docs.md`): under Fixes and Improvements, one bullet for missed events arriving after a reconnect and one for the faster restart; under Upgrade notes, the Origin check (an operator whose proxy rewrites `Origin` must list the public origin in `TRUSTED_ORIGINS`) and that the mobile app is parked and unsupported on this release until its rewrite ships.
- `pnpm format` and `pnpm build` inside `apps/docs` (a standalone workspace).

**Blocked by:** 07, 08.

**Spec:** `.scratch/realtime-foundation/spec.md` § Release shape

**Status:** ready-for-human

- [x] Index entries read **Accepted.**; ADR bodies match the shipped code
- [x] `CONTEXT.md` `### Realtime` verified against the code
- [x] `websocket.md` in the docs sidebar; `server-runtime.md` links it
- [x] Release notes updated: two improvement bullets, two upgrade notes
- [x] `pnpm format` and `pnpm build` in `apps/docs` green; the four root gates green

## Comments

- Implemented on `claude/continue-realtime-foundation-migration-mcxdc9`.
  - **Target Version is `0.24.0-beta`.** `v0.23.1-beta` is tagged but its docs were still the editable ones (no checkpoint had run since it shipped), so per `docs/agents/feature-docs.md` the checkpoint ran first: `pnpm docs_update 0.24.0-beta` froze `0.23.1-beta` under `versioned_docs/` and moved the editable label. The realtime rebuild carries two upgrade notes and drops mobile support, which is a minor bump, not a patch.
  - The three index entries read **Accepted.** One ADR detail drifted: ADR-0034 named the stream `norish:stream:<channel>`, which reads as a prefix on the full channel; it is the channel with its `norish:` prefix replaced (`streamKeyFor`), and the buffered entry keeps the `$ID$` placeholder and is stamped with its entry id on resume rather than carrying it in the stream. Both sentences are corrected. Bounds (about a thousand entries, a day), close codes (1012, 4000, 4401), the `identity-changed` refusal and every file name in the three ADRs match the code.
  - `CONTEXT.md` `### Realtime`: every term names something that exists (`defineRealtimeCatalogue`, `RealtimeEventEnvelope`, `RealtimeHub`, `RealtimeLaggedError`, `CURSOR_MARK`/`isCursorMark`, `streamKeyFor`, `emitConnectionInvalidation`); no edit was needed. The `Recovery` entry already points at ADR-0034.
  - `apps/docs/docs/configuration/websocket.md` sits beside Server & runtime in the sidebar (positions after it shifted by one); `server-runtime.md` links it beside `REDIS_URL` and under `TRUSTED_ORIGINS`. `.env.example` notes that `TRUSTED_ORIGINS` is checked on WebSocket upgrades.
  - Release notes `0.24.0-beta.md`: the two improvement bullets the ticket asks for plus three that fell out of the rebuild and are user-visible (sign-in instead of a reconnect loop, a validation failure toasts only its author, Redis connections independent of tabs); the two upgrade notes.
  - Gates: `pnpm lint`, `pnpm i18n:check`, `pnpm build` green; `pnpm format` and `pnpm build` in `apps/docs` green. `pnpm test:run` is green in every package except one file, `packages/queue/__tests__/paste-import/worker.integration.test.ts`, which starts a PostgreSQL testcontainer and cannot run without a Docker daemon (this environment has none); the queue package passes 30/30 files with that one excluded.
  - Still open for ticket 10: the spec's `apps/web/__tests__/e2e/realtime/realtime.e2e.ts` was never written by 04 or 07 and does not exist; ticket 10 requires it green before the manual checks. This environment has no Docker daemon, so it could not be written against a running stack here.
