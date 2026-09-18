# 10 — Manual release verification

**What to build:** nothing. Run the checks below against a production-style stack (the E2E harness in `apps/web/__tests__/e2e/harness/production-stack.ts`, or a compose stack with a reverse proxy in front) and record the outcomes, with dates and versions, under Comments. The automated E2E in `apps/web/__tests__/e2e/realtime/realtime.e2e.ts` (written with ticket 04 or 07, whichever first has both ends) must be green before starting. When every box is ticked and ticket 09 has shipped, delete `.scratch/realtime-foundation/`; the ADRs and the docs page are what outlives it.

**Blocked by:** 09.

**Spec:** `.scratch/realtime-foundation/spec.md` § Verification

**Status:** ready-for-human

- [ ] Two browsers, one household: grocery create, update and delete propagate without a reload; a validation failure toasts only the browser that caused it
- [ ] Browser B joins A's household while connected: B's socket closes with `4000`, reconnects, later events from A reach B; the server log shows B's old cursor refused with `identity-changed` and B's lists refetch
- [ ] Server restart with both browsers connected: clients receive `1012`, reconnect within the backoff window, the events published during the restart arrive through Resume, Recovery runs once
- [ ] `SIGTERM` with fifty open sockets (a small script with `ws`): shutdown completes in under five seconds and the log shows the documented order
- [ ] Redis restart: the server logs `realtime.reconnected`; every subscription ends Lagged; both browsers refetch and converge
- [ ] `redis-cli CLIENT LIST` shows the same connection count with one tab and with five; `redis-cli TTL norish:stream:grocery:household:<key>:created` is at most 86400 and a key untouched for a day is gone
- [ ] Behind the proxy: a mismatched `Origin` is refused with `403`; an absent `Origin` (`curl` with an upgrade request) is accepted; a proxy idle timeout of 30 s keeps the socket alive across five minutes of silence
- [ ] An expired session: the browser lands on the sign-in page, not in a reconnect loop

## Comments
