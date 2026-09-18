# 08 — WebSocket client transport: backoff with jitter, one unauthorized path, honest closes

**What to build:** in `packages/shared-react/src/providers/trpc-links.ts` and `trpc-provider.tsx`:

- `retryDelayMs` (`trpc-links.ts:340-348`) becomes full-jitter exponential backoff, `random() * Math.min(30_000, 1_000 * 2 ** attemptIndex)`, with the RNG injectable so tests are deterministic.
- An unauthorized close is close code `4401` only (the server sends it from ticket 06); delete the reason-string regex at `:118` and the message regex at `:154`. On 4401 the client stops retrying, fires `onWebSocketUnauthorized` once, and the latch is per client instance, so a client created after re-login retries normally.
- Every close, including a normal `1000`, reaches `onWebSocketClose` (fix the short-circuit at `trpc-provider.tsx:201-205`).
- `ConnectionStatus` drops the never-assigned `"connecting"`.
- Delete `shouldNotifyWebSocketDisconnect`, `getWsLazyEnabled`, `invalidateOnReconnect` (Recovery owns reconnect refetch, ADR-0011) and `onWebSocketClientDestroy` from the options type if nothing uses it.
- `TRPCLink<any>` at `:47, 48, 191, 200, 213` becomes `TRPCLink<TRouter>`; `TRPCClientContextValue` stops being `object | null` so `useTRPCClient()` consumers stop casting.
- `apps/web/app/providers/trpc-provider.tsx` passes an `onWebSocketUnauthorized` handler that routes to the sign-in flow.

`apps/mobile` is parked (01) and is not touched.

**Blocked by:** 06. Independent of 07.

**Spec:** `.scratch/realtime-foundation/spec.md` § Client

**Status:** ready-for-agent

- [ ] `packages/shared-react/__tests__/providers/trpc-links.test.ts`: attempts 0..6 fall within `[0, min(30000, 1000·2^n)]` and are not all equal; `4401` → no further attempt and the callback once; `1012` and `1006` → retry; a new client instance after a 4401 retries
- [ ] A `1000` close reaches `onWebSocketClose`
- [ ] No `TRPCLink<any>`; `ConnectionStatus` = `"idle" | "connected" | "disconnected"`; no `trpcClient as` cast in `apps/web`
- [ ] Web passes `onWebSocketUnauthorized`; an expired session in a browser ends at the sign-in page rather than in a reconnect loop
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments
