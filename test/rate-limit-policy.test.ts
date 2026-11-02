import { describe, it, expect } from "vitest";
import { RATE_LIMIT, decide, nextWindow } from "../src/rate-limit/policy.ts";

const { windowMs } = RATE_LIMIT;

describe("nextWindow", () => {
  it("opens a window when there is no previous state", () => {
    expect(nextWindow(undefined, 5_000, windowMs)).toEqual({ count: 1, windowStart: 5_000 });
  });

  it("keeps the window at t=59,999 ms", () => {
    expect(nextWindow({ count: 7, windowStart: 0 }, 59_999, windowMs)).toEqual({ count: 8, windowStart: 0 });
  });

  it("opens a new window at t=60,000 ms", () => {
    expect(nextWindow({ count: 7, windowStart: 0 }, 60_000, windowMs)).toEqual({ count: 1, windowStart: 60_000 });
  });
});

describe("decide", () => {
  it("allows count 100", () => {
    expect(decide({ count: 100, windowStart: 0 }, 0)).toEqual({ allowed: true });
  });

  it("rejects count 101", () => {
    expect(decide({ count: 101, windowStart: 0 }, 0).allowed).toBe(false);
  });

  it.each([
    [0, 60],
    [30_000, 30],
    [30_500, 30],
    [59_000, 1],
    [59_999, 1],
  ])("at t=%i ms gives retryAfterSeconds %i", (now, retryAfterSeconds) => {
    expect(decide({ count: 101, windowStart: 0 }, now)).toEqual({ allowed: false, retryAfterSeconds });
  });
});
