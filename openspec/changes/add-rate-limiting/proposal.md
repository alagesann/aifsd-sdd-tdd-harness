# Proposal

## Why

The Orders API accepts unlimited traffic, so a single client can consume capacity meant for everyone else. A per-key limit caps each client's share and gives it a standard signal for when to retry.

## What Changes

- Each API key, sent in the `X-API-Key` header, is limited to 100 requests per fixed 60-second window. The window opens on that key's first request.
- A request over the limit receives HTTP 429 with a `Retry-After` header giving the seconds until the window ends.
- Keys are counted independently, and the limit holds exactly under concurrent requests.
- Requests with no key, or an empty one, pass through unlimited. Existing keyless clients are unaffected, so this change is not breaking.
- Counters live in an in-memory store behind an interface, so a Redis implementation can replace it later without changing the rate-limit logic.

**Out of scope:**

- Per-route limits: one counter per key covers all routes.
- Multi-instance counting: each process counts on its own, and counters reset on restart.
- A Redis implementation.
- API key validation or authentication.

## Capabilities

### New Capabilities
- `rate-limiting`: Per-API-key request limiting over a fixed window, including the 429 and `Retry-After` response, key independence, keyless pass-through, and correctness under concurrent requests.

### Modified Capabilities

None. `openspec/specs/` has no existing capabilities.

## Impact

- **API:** every route can now return 429 to a request that carries a key. Responses within the limit do not change.
- **Code:** new `src/rate-limit/` module. `buildApp` in `src/app.ts` registers it and accepts optional `store` and `clock` through `buildApp({ store, clock })`; `buildApp()` with no arguments keeps working.
- **Tests:** new `test/rate-limit.test.ts` and `test/fake-clock.ts`. `test/orders.test.ts` passes unchanged because it sends no key.
- **Dependencies:** none added.

## For the reviewer

- **Risky decision:** nothing validates keys, so omitting the key or sending a new one each time avoids the limit. This limits identified clients and is not an abuse defense; closing the gap needs a separate key validation change.
- **Risky decision:** each window opens on a key's first request, and fixed windows allow up to 200 requests across a window boundary.
- **Assumption:** the key is the exact, case-sensitive `X-API-Key` value, and an empty value counts as missing.
- **Assumption:** rejections use the body `{"error":"Too Many Requests"}`, and all paths share one counter, so a blocked key gets 429 on an unknown path instead of 404.
- **Scope cut:** counters are per-process and reset on restart, and this change adds no Redis store, `X-RateLimit-*` headers or Redis failure policy.
