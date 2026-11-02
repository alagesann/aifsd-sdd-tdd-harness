# Tasks

Name each test after the spec scenario it covers. Tests use `FakeClock` and never sleep.

## 1. Clock and pure rules

- [x] 1.1 Add `src/rate-limit/clock.ts` (`Clock`, `systemClock`) and `test/fake-clock.ts` (`FakeClock` with settable time), and verify with `npm run typecheck`
- [x] 1.2 Add `src/rate-limit/store.ts` with the `WindowState` type and `RateLimitStore` interface, documenting that `hit` must be atomic, and verify with `npm run typecheck`
- [x] 1.3 Write unit tests for `nextWindow` (no previous state, t=59,999 ms keeps the window, t=60,000 ms opens a new one) and `decide` (count 100 allowed, count 101 rejected, `retryAfterSeconds` of 60, 30, 30, 1, 1 at t=0, 30,000, 30,500, 59,000, 59,999 ms), and verify they fail
- [x] 1.4 Implement `src/rate-limit/policy.ts` (`RATE_LIMIT`, `nextWindow`, `decide`) as pure functions and verify the 1.3 tests pass

## 2. In-memory store

- [x] 2.1 Write store tests: first `hit` returns count 1, later hits increment, a hit at t=60,000 ms returns count 1 with a new `windowStart`, keys do not share counts, and 150 concurrent `hit` calls under `Promise.all` return each count from 1 to 150 exactly once; verify they fail
- [x] 2.2 Write an eviction test using a read-only `size` getter on the in-memory store (not part of `RateLimitStore`): after a key's window expires, a `hit` on a different key removes the expired entry, while unexpired entries stay; verify it fails
- [x] 2.3 Implement `src/rate-limit/memory-store.ts` with the read-modify-write fully synchronous inside `hit`, plus head-of-`Map` eviction and re-insertion on rollover, and verify the 2.1 and 2.2 tests pass

## 3. HTTP behavior

- [x] 3.1 Write `test/rate-limit.test.ts` covering every scenario under "Requests are limited per API key" using `app.inject`, and verify the limit-dependent ones fail
- [x] 3.2 Add scenarios from "Windows are fixed and start on a key's first request" and "Rejections state when to retry", including the t=59,999 ms and t=60,000 ms boundaries, and verify they fail
- [x] 3.3 Add scenarios from "API keys are independent" and "Requests without a key are not limited", and verify the limit-dependent ones fail
- [x] 3.4 Add scenarios from "The limit is exact under concurrent requests", sending requests with `Promise.all` at a frozen `FakeClock`, and verify they fail
- [x] 3.5 Implement `registerRateLimit` in `src/rate-limit/plugin.ts` as a root `onRequest` hook: skip a missing or empty key, await one `hit`, call `decide`, and on rejection return 429 with `Retry-After` and `{"error":"Too Many Requests"}`
- [x] 3.6 Wire it into `buildApp({ store, clock })`, with both optional and defaulting to a new `InMemoryRateLimitStore` and `systemClock`, and verify all of `test/rate-limit.test.ts` passes

## 4. Verification

- [x] 4.1 Confirm the concurrency tests catch a race by temporarily adding an `await` between the read and write in `hit`, seeing the tests fail, and reverting the edit
- [x] 4.2 Run `npm test` and `npm run typecheck` and verify both pass, with `test/orders.test.ts` unchanged
- [x] 4.3 Run `openspec validate add-rate-limiting --strict` and verify it passes
- [x] 4.4 Start the app with `npm start`, send 101 `curl` requests with `X-API-Key: smoke`, and verify the 100th returns 200 and the 101st returns 429 with a `Retry-After` header, which also confirms the source runs under Node's type stripping
