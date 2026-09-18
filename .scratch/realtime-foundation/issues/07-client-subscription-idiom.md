# 07 — One client subscription idiom: typed handlers, no shim, one lag reaction

**What to build:** `packages/shared-react/src/realtime/use-realtime-subscription.ts` as in `spec.md` § Client, plus `isRealtimeLagged(err)` (`err instanceof TRPCClientError && err.message === REALTIME_LAGGED`). Every hook that calls `subscriptionOptions` — sixteen files under `packages/shared-react/src/hooks/`, seventy-seven call sites — moves to it, typing payloads with `PayloadOf<Catalogue, Event>` from the catalogues and passing `lagQueryKeys` for its domain. A Cursor Mark never reaches a handler; anything that is neither a mark nor an envelope is an assertion failure, not a case.

**Deleted:** `wrapTrpcProxy`, `wrapSubscriptionObserverOptions`, `withPayloadCompatibility` and `createNormalizedUseTRPC` in `packages/shared-react/src/providers/trpc-provider.tsx:34-115` (`useTRPC` becomes the raw context); `unwrapPayload`, `normalizeSubscriptionData`, `extractMeta` and `NormalizedSubscriptionData` in `packages/shared/src/lib/operation-helpers.ts`; the four `asSubscriptionOptions` casts and every `any` in a subscription handler; `packages/shared-react/src/providers/trpc-provider.test.ts`'s shim cases; the dead web wrappers `apps/web/hooks/recipes/use-recipes-subscription.tsx` and `apps/web/hooks/ratings/use-ratings-subscription.ts` with `apps/web/__tests__/hooks/recipes/use-recipes-subscription.test.ts` and `apps/web/__tests__/hooks/ratings/use-ratings-subscription.test.tsx` (port any assertion worth keeping into `packages/shared-react/__tests__/hooks/`).

**Handler fixes made in the migration:** `hooks/permissions/use-permissions-query.ts:24` invalidates `permissions.get` and the recipe list keys only, never `invalidateQueries()` bare, and the duplicate `onPolicyUpdated` subscription at `hooks/recipes/recipe/use-recipe-subscription.ts:83` goes; `hooks/caldav/use-caldav-subscription.ts` keeps `onSyncEvent` and drops `onItemStatusUpdated`/`onInitialSyncComplete`; `hooks/recipes/shares/use-recipe-share-subscription.ts` uses `onShareEvent`; `hooks/recipes/dashboard/use-ratings-subscription.ts:40-71` keeps its `setQueriesData` and drops the blanket invalidate; `hooks/recipes/dashboard/use-recipes-subscription.ts:146,:159` use `trpc.<proc>.queryKey()`. No echo suppression is added anywhere; every handler stays an idempotent merge by identity.

`apps/mobile` is parked (01) and is not touched.

**Blocked by:** 06. Independent of 08.

**Spec:** `.scratch/realtime-foundation/spec.md` § Client

**Status:** ready-for-agent

- [ ] `grep -rn "as any\|: any" packages/shared-react/src/hooks` has no hit in a subscription handler; `wrapTrpcProxy` and `unwrapPayload` do not exist
- [ ] Every handler is `(payload, meta)`; `packages/shared-react/__tests__/realtime/use-realtime-subscription.test.tsx` (mocked `useSubscription`) proves a Cursor Mark never reaches `onEvent`, a `REALTIME_LAGGED` error invalidates exactly `lagQueryKeys` then calls `reset()`, a non-lag error does neither, and the subscription after `reset()` carries no `lastEventId`
- [ ] Permissions: one subscription, filtered invalidation; CalDAV: one subscription, one toast per event; shares: one procedure; ratings: no blanket invalidate; no hand-written query keys
- [ ] Dead web wrappers and their tests deleted
- [ ] `apps/web/app/providers/trpc-provider.tsx` compiles without the normalized proxy; groceries, stores, recipes, cookbooks, calendar, households, CalDAV and archive flows checked in a browser
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments
