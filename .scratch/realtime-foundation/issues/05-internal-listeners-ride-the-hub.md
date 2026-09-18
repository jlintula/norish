# 05 — Internal listeners ride the hub

**What to build:** the three server-internal subscribers become `getRealtimeHub().on(channel, handler)` registrations, the hub is started and stopped with the process, and no code outside `hub.ts` opens a Redis subscriber connection any more.

1. `packages/trpc/src/connection-manager.ts:89-158`: `startInvalidationListener`/`stopInvalidationListener` become `startConnectionInvalidation()` returning the `hub.on` unsubscribe function; the `on(subscriber, "message")` loop, the `globalThis` abort controller and subscriber, and the 100 ms sleep go. The handler reads the `connection.invalidate` envelope's payload (from 04) and calls `terminateUserConnections(userId, reason)`.
2. `packages/api/src/recipes/enrichment-listener.ts`: keeps `initRecipeEnrichmentListener`/`stopRecipeEnrichmentListener` and `handleRecipeBecameUsable`, registers with `hub.on(recipeEnrichment.channel("recipeBecameUsable", undefined), …)`, and `init` still resolves only once the registration is in place. Its test drops `FakeSubscriber`, mocks the hub, and keeps every handler assertion (duplicate delivery, wrong channel, unparseable payload, throwing handler).
3. `packages/api/src/caldav/event-listener.ts`: `startCalendarSubscriptions` (`:114-190`) registers one `hub.on` per `internal` calendar companion event declared in 04, so the string-splitting of channel names and the raw `psubscribe` go; `startRecipeSubscriptions` (`:312-338`, a live connection around a `TODO`) is deleted; the double cleanup at `:141` and `:180-187` goes with the loop; `stopCaldavSync` returns a promise that resolves once every registration is released, and `shutdown.ts` awaits it before logging "stopped".
4. `apps/web/server/index.ts`: `await startRealtimeHub()` immediately before `initCaldavSync()`. `packages/api/src/startup/shutdown.ts`: `await stopRealtimeHub()` after `stopWorkers()` and before `closeRedisConnections()`; the file's header comment lists the new order (HTTP → WebSocket → internal listeners → workers → hub → Redis).

**Blocked by:** 04.

**Spec:** `.scratch/realtime-foundation/spec.md` § Realtime Hub, § Connection lifecycle

**Status:** ready-for-agent

- [ ] `grep -rn "createSubscriberClient" packages apps --include=*.ts` matches only `packages/shared-server/src/realtime/hub.ts` and `redis/client.ts`
- [ ] `connection-manager.ts` has no message loop, no `setTimeout`, no `globalThis` subscriber; a test delivers a `connection.invalidate` envelope through a fake hub and asserts `terminateUserConnections(userId, reason)`
- [ ] `enrichment-listener.test.ts` keeps its handler assertions and asserts `init` registers before resolving
- [ ] A test enumerates the events `handleCalendarEvent` handles and asserts each has an `internal` companion in the calendar catalogue and a `hub.on` registration
- [ ] `startRecipeSubscriptions` is gone; `stopCaldavSync` is awaited in `shutdown.ts`
- [ ] Hub started before `initCaldavSync`, stopped after workers; the startup log shows `Realtime hub started` before the CalDAV line
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments
