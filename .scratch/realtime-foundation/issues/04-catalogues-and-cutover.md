# 04 — Catalogues for every domain and the cutover of all publishers and procedures

**What to build:** every realtime event declared once in a catalogue, every publish site moved to its domain object, all 58 subscription procedures rewritten as `realtimeSubscription` lines, and the old layer deleted — in one ticket, so that the server never has two ways to publish or subscribe. Lands as one stack with 03, 05 and 06.

**Catalogues** in `packages/shared/src/contracts/realtime/`, one file per namespace, events and scopes taken from today's `packages/shared-server/src/realtime/*.ts` and `packages/trpc/src/routers/{calendar,ratings,permissions,caldav}/types.ts`, payload schemas from `packages/shared/src/contracts/zod/*.ts` where they exist and `z.custom<T>()` with a one-line comment where they do not (list every `z.custom` in this ticket's Comments):

- `groceries.ts` (`grocery`): the eight events; `failed` moves to scope `user` — today it is household-scoped, so one member's validation failure toasts the whole household.
- `recipes.ts` (`recipe`): the events of `RecipeSubscriptionEvents` on scope `policy` where today's publisher goes through `emitByPolicy`, `household`/`user` otherwise; the five `share*` events become one `shareEvent { kind: "created" | "updated" | "revoked" | "reactivated" | "deleted"; share }`.
- `cookbooks.ts`, `ratings.ts` (`policy`), `stores.ts` (`household`), `calendar.ts` (`household`, plus one `internal` companion per event the CalDAV listener reacts to — see 05), `households.ts` (the `Household*EventSchema` schemas, the first domain with real runtime validation), `caldav.ts` (`user`; delete the duplicate type in `routers/caldav/types.ts`), `permissions.ts` (`policyUpdated`, `broadcast`; replaces the inline type at `routers/permissions/subscriptions.ts:10-16`), `archive.ts` (`user`), `recipe-enrichment.ts` (`recipeBecameUsable`, `internal`), `connection.ts` (`invalidate { userId, reason }`, `internal`).

**Domains** in `packages/shared-server/src/realtime/<domain>.ts`: one `defineRealtimeDomain(...)` line each; `connection-invalidation.ts` becomes `connection.ts` with an `emitConnectionInvalidation(userId, reason)` that awaits `connection.publish`.

**Publishers:** every call site in `packages/trpc/src/routers/**`, `packages/queue/src/**`, `packages/api/src/**`, `packages/auth/src/claim-processor.ts` and `packages/shared-server/src/accounts/deletion.ts` becomes `domain.publish(event, payload, target)` with an explicit `void` or `await`. Three behaviour fixes ride along: `packages/trpc/src/routers/archive/archive.ts:169` routes by policy like every other recipe create instead of unconditionally to the household; the four sites in `routers/households/households.ts` (`:147-152`, `:223/237`, `:293/297`, `:364-380`) `await` the household event before they `await` the invalidation, so the departing view receives it before its socket closes; the share mutations publish `shareEvent`.

**Procedures:** every `routers/*/subscriptions.ts` becomes a list of `realtimeSubscription(domain, "event")` lines (recipes' five share procedures become `onShareEvent`). The six `if (!ctx.household) { await waitForAbort(signal); return; }` guards in `routers/households/subscriptions.ts` go: a household-less user's household channel is `household:{userId}` and simply stays quiet.

**Deleted in this ticket:** `packages/shared-server/src/redis/{pubsub,subscription-multiplexer,channel-metadata}.ts` and their package exports; `packages/shared-server/src/realtime/policy.ts`; every `globalThis.__xEmitter__` emitter; `packages/trpc/src/emitter.ts`; `packages/trpc/src/routers/{calendar,permissions,ratings}/emitter.ts`; the realtime types in `routers/*/types.ts`; `createSubscriptionIterable`, `createEnvelopeSubscriptionIterable`, `createPolicyAwareIterables`, `createEnvelopeAwareSubscription` and `waitForAbort` in `packages/trpc/src/helpers.ts` (`mergeAsyncIterables` moves beside the factory if `realtime-resume.ts` uses it, otherwise it goes too); `ctx.multiplexer` in `packages/trpc/src/context.ts` and `getOrCreateMultiplexer` in `middleware.ts:45-47`; the seven emitter fakes in `packages/trpc/__tests__/mocks/`; `packages/trpc/__tests__/helpers.test.ts`. Every test that mocked an emitter uses `createFakeRealtimeDomain` from 03 and keeps its assertions.

**Blocked by:** 03.

**Spec:** `.scratch/realtime-foundation/spec.md` § Realtime Catalogue, § Domain, § Subscription factory

**Status:** ready-for-agent

- [ ] Twelve catalogue files; every `z.custom` listed in Comments
- [ ] `grep -rn "createTypedEmitter\|TypedRedisEmitter\|__[A-Za-z]*Emitter__\|emitByPolicy\|createSubscription(\|getOrCreateMultiplexer\|waitForAbort" packages apps --include=*.ts` is empty
- [ ] Every `routers/*/subscriptions.ts` contains only `realtimeSubscription` lines; 58 procedures become 54 (five share procedures → one)
- [ ] No floating publish promise: every `publish(` is preceded by `void ` or `await `
- [ ] `grocery.failed` targets `{ userId }` (fake-domain test); every other event keeps its scope
- [ ] Archive-created recipes route by policy (fake-domain test in `packages/trpc/__tests__/archive`)
- [ ] Households: for create, join, leave, kick and admin transfer the fake domain's recorded call list has the household event before `connection.invalidate`
- [ ] `households/subscriptions.ts` has no `!ctx.household` guard
- [ ] Household publishes validate against the zod schemas; a malformed publish throws under test
- [ ] The web client still compiles and behaves as before through its existing shim (07 removes it); grocery, store, recipe, cookbook, calendar, household and CalDAV flows checked in a browser
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments
