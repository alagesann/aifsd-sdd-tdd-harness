# Spec Delta

## Purpose

Caps how many requests each API key can make in a fixed time window, and tells clients over the limit when they can retry.

## ADDED Requirements

### Requirement: Requests are limited per API key
The system SHALL identify a client by the exact value of the `X-API-Key` request header and SHALL allow at most 100 requests per key in a window. A request over the limit SHALL NOT reach the route handler and SHALL receive HTTP 429 with the JSON body `{"error":"Too Many Requests"}`.

#### Scenario: Request exactly at the limit is allowed
- **WHEN** a client sends 100 `GET /orders` requests with `X-API-Key: key-a` at t=0 ms
- **THEN** all 100 responses are HTTP 200 with body `{"orders":[]}` and no `Retry-After` header

#### Scenario: First request over the limit is rejected
- **WHEN** a client sends 101 `GET /orders` requests with `X-API-Key: key-a` at t=0 ms
- **THEN** the 101st response is HTTP 429 with body `{"error":"Too Many Requests"}` and header `Retry-After: 60`

#### Scenario: All paths share one counter
- **WHEN** a client has sent 100 `GET /orders` requests with `X-API-Key: key-a` in the current window and sends `GET /unknown` with the same key
- **THEN** the response is HTTP 429 rather than HTTP 404

### Requirement: Windows are fixed and start on a key's first request
A key's window SHALL open on the first request that key makes when it has no open window, and SHALL last exactly 60 seconds. A request arriving 60,000 ms or more after the window opened SHALL open a new window with a count of 1. Rejected requests SHALL NOT extend or restart the window.

#### Scenario: Last millisecond of the window is still limited
- **WHEN** `key-a` opened its window at t=0 ms, sent 100 requests, and sends another at t=59,999 ms
- **THEN** the response is HTTP 429 with header `Retry-After: 1`

#### Scenario: New window starts exactly at 60 seconds with a full allowance
- **WHEN** `key-a` opened its window at t=0 ms, sent 100 requests, and sends 101 more at t=60,000 ms
- **THEN** the first 100 of those responses are HTTP 200 and the 101st is HTTP 429

#### Scenario: Rejected requests do not extend the window
- **WHEN** `key-a` opened its window at t=0 ms, sent 100 requests, and received HTTP 429 for a request at t=50,000 ms
- **THEN** a request at t=60,000 ms is HTTP 200

### Requirement: Rejections state when to retry
Every HTTP 429 response SHALL include a `Retry-After` header giving the whole seconds until the key's window ends, rounded up. Its value SHALL be between 1 and 60 inclusive.

#### Scenario: Partial seconds round up
- **WHEN** `key-a` opened its window at t=0 ms, sent 100 requests, and sends another at t=30,500 ms
- **THEN** the response is HTTP 429 with header `Retry-After: 30`

### Requirement: API keys are independent
The system SHALL keep a separate count and window for each distinct `X-API-Key` value. Values SHALL be compared exactly, including case.

#### Scenario: Each key has its own count and window
- **WHEN** `key-a` sends 100 requests at t=0 ms and `key-b` sends 100 requests at t=30,000 ms
- **THEN** all 200 responses are HTTP 200, and at t=60,000 ms a `key-a` request is HTTP 200 and a `key-b` request is HTTP 429 with header `Retry-After: 30`

#### Scenario: Keys differing only by case are distinct
- **WHEN** `key-a` has sent 100 requests and `KEY-A` sends its first request
- **THEN** the `KEY-A` response is HTTP 200

### Requirement: Requests without a key are not limited
A request with a missing or empty `X-API-Key` header SHALL NOT be counted or rejected by the rate limiter.

#### Scenario: Missing header passes through
- **WHEN** a client sends 101 `GET /orders` requests with no `X-API-Key` header within 60 seconds
- **THEN** all 101 responses are HTTP 200 with no `Retry-After` header

#### Scenario: Empty header passes through
- **WHEN** a client sends 101 `GET /orders` requests with `X-API-Key` set to an empty value within 60 seconds
- **THEN** all 101 responses are HTTP 200 with no `Retry-After` header

### Requirement: The limit is exact under concurrent requests
The system SHALL allow exactly the number of requests the limit permits when requests for a key are in flight at the same time, without over-admitting or under-admitting any.

#### Scenario: Concurrent requests over the limit
- **WHEN** 150 requests with `X-API-Key: key-a` are in flight at the same time at t=0 ms
- **THEN** exactly 100 responses are HTTP 200 and exactly 50 are HTTP 429 with header `Retry-After: 60`
