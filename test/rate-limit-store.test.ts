import { describe, it, expect } from "vitest";
import { InMemoryRateLimitStore } from "../src/rate-limit/memory-store.ts";

const windowMs = 60_000;

describe("InMemoryRateLimitStore", () => {
  it("returns count 1 on the first hit", async () => {
    const store = new InMemoryRateLimitStore();
    expect(await store.hit("key-a", 0, windowMs)).toEqual({ count: 1, windowStart: 0 });
  });

  it("increments on later hits", async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit("key-a", 0, windowMs);
    expect(await store.hit("key-a", 10, windowMs)).toEqual({ count: 2, windowStart: 0 });
  });

  it("returns count 1 with a new windowStart at t=60,000 ms", async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit("key-a", 0, windowMs);
    await store.hit("key-a", 10, windowMs);
    expect(await store.hit("key-a", 60_000, windowMs)).toEqual({ count: 1, windowStart: 60_000 });
  });

  it("does not share counts between keys", async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit("key-a", 0, windowMs);
    await store.hit("key-a", 0, windowMs);
    expect(await store.hit("key-b", 0, windowMs)).toEqual({ count: 1, windowStart: 0 });
  });

  it("gives 150 concurrent hits each count from 1 to 150 exactly once", async () => {
    const store = new InMemoryRateLimitStore();
    const states = await Promise.all(Array.from({ length: 150 }, () => store.hit("key-a", 0, windowMs)));
    const counts = states.map((state) => state.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 150 }, (_, i) => i + 1));
  });

  it("evicts an expired entry on a hit for a different key and keeps unexpired entries", async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit("key-a", 0, windowMs);
    await store.hit("key-b", 30_000, windowMs);
    expect(store.size).toBe(2);
    await store.hit("key-c", 60_000, windowMs);
    expect(store.size).toBe(2);
    expect(await store.hit("key-b", 60_000, windowMs)).toEqual({ count: 2, windowStart: 30_000 });
  });
});
