# Design

## Context

`buildApp()` in `src/app.ts` creates a Fastify instance with one route, `GET /orders`. There is no auth, no plugin structure, and no `fastify-plugin` dependency. `npm start` runs the TypeScript directly with Node, so source must use erasable syntax only: no enums or parameter properties, and `import type` for types.

Project conventions shape the layout: business rules are pure functions under `src/rate-limit/`, I/O stays in Fastify plugins and stores, and time comes from an injected Clock. See `proposal.md` for motivation and `specs/rate-limiting/spec.md` for required behavior.

| File | Role |
|---|---|
| `src/rate-limit/clock.ts` | `Clock` interface (`now(): number`, epoch ms) and `systemClock` |
| `src/rate-limit/policy.ts` | Pure: `RATE_LIMIT` constants, `nextWindow`, `decide` |
| `src/rate-limit/store.ts` | `RateLimitStore` interface and `WindowState` type |
| `src/rate-limit/memory-store.ts` | `InMemoryRateLimitStore` |
| `src/rate-limit/plugin.ts` | `registerRateLimit(app, { store, clock })`, the Fastify hook |
| `test/fake-clock.ts` | `FakeClock` with settable time |

## Goals / Non-Goals

**Goals:**
- Replacing the store with Redis requires only a new store class and no change to the rules or the hook.
- Every window boundary can be tested with a fake clock and no sleeping.
- In-memory state stays bounded by the keys active in the last 60 seconds.

**Non-Goals:**
- Configurable limits. 100 and 60,000 ms are named constants in one place.
- `X-RateLimit-*` informational headers.
- Handling a store that fails, which cannot happen in memory (see Open Questions).

## Decisions

### 1. The store exposes one atomic operation

`RateLimitStore` has one method, `hit(key, now, windowMs): Promise<WindowState>`, which records a request and returns `{ count, windowStart }`. The concurrency rule is made atomic inside `hit` and nowhere else: `InMemoryRateLimitStore` runs its read-modify-write synchronously with no `await`, and a Redis store must use one Lua script or equivalent. The hook never touches counts; it awaits one `hit` and decides on the returned value, so 150 concurrent requests see counts 1 through 150. Returning a Promise means Redis needs no caller changes.

*Rejected:* separate `get` and `increment` methods, because reading and writing across an `await` over-admits under concurrency.

### 2. Rules are pure, and the store always increments

`nextWindow(previous, now, windowMs)` opens a window when none exists or when `now - windowStart >= windowMs`, and a store applies it inside `hit`. `decide(state, now)` allows when `count <= 100`, and otherwise returns `Math.ceil((windowStart + windowMs - now) / 1000)` as `retryAfterSeconds`. Rejected requests still increment, so the store never needs the limit and `windowStart` cannot move. The hook reads the Clock and passes `now`, so stores need no clock.

*Rejected:* a conditional increment in the store, because it moves a business rule into the store with no observable benefit.

### 3. Eviction runs on each hit, without timers

Keys are unvalidated, so stale entries must not live forever. Each `hit` removes expired entries from the head of the store's `Map`. A key opening a new window is deleted and re-inserted, which keeps the `Map` ordered by `windowStart`. The scan stops at the first live entry, so it costs amortized O(1) per request.

*Rejected:* `setInterval` sweeping, because it needs real timers, which conflict with the no-sleep test rule, and shutdown handling.

### 4. A root hook wired through a flat `buildApp`

`registerRateLimit(app, { store, clock })` adds an `onRequest` hook to the root instance, which runs for unmatched paths (checked against the installed Fastify) and before body parsing. `buildApp({ store, clock }: { store?: RateLimitStore; clock?: Clock } = {})` defaults to a new `InMemoryRateLimitStore` per call and `systemClock`, so each app has its own counters and `buildApp()` still works. The key is `request.headers["x-api-key"]` as an opaque string, repeated headers arrive as one comma-joined string, and a missing or empty value skips the store. The key is never logged or returned in a response.

*Rejected:* `app.register`, because reaching the root needs `fastify-plugin` or a `skip-override` symbol. Nested `{ rateLimit: { store, clock } }` options, because there are no other options to group.

## Risks / Trade-offs

- **Omitted or rotating keys avoid the limit** → Accepted and recorded in the proposal. Closing this needs key validation, which is a separate change.
- **Unvalidated keys can grow memory within a window** → A client sending a new key on each request adds entries for up to 60 seconds. Eviction bounds this to keys active in the last 60 seconds, and Node's default maximum header size bounds each key. No hard cap on entries is added.
- **A burst of up to 200 requests can straddle two windows** → Inherent to fixed windows, which were explicitly requested.
- **The system clock can step backward** → `Date.now()` can jump under NTP correction. A key's window could last longer, `Retry-After` could briefly exceed 60, and head-of-`Map` eviction could stop early until time catches up. Limits stay enforced and the effect is temporary, so this is accepted rather than adding a monotonic clock that would not carry over to Redis.
- **Counters reset on restart and are per-process** → Accepted. Multi-instance counting is out of scope.

## Migration Plan

No data migration. Deploying enables the limit for requests with a key, and rollback is reverting the change. Counters are in memory, so neither leaves any state behind.

## Open Questions

- When a Redis store is added, should a store failure allow the request (fail open) or return an error (fail closed)? It cannot occur with the in-memory store, so this can wait. Until then a rejected `hit` propagates to Fastify's default HTTP 500.
