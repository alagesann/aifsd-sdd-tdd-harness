import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import { FakeClock } from "./fake-clock.ts";

function setup() {
  const clock = new FakeClock();
  const app = buildApp({ clock });
  const get = (key?: string, url = "/orders") =>
    app.inject({ method: "GET", url, headers: key === undefined ? {} : { "x-api-key": key } });
  const send = async (count: number, key?: string) => {
    const responses = [];
    for (let i = 0; i < count; i++) {
      responses.push(await get(key));
    }
    return responses;
  };
  return { clock, get, send };
}

describe("rate limiting", () => {
  it("[scenario: rate-limiting/Request exactly at the limit is allowed]", async () => {
    const { send } = setup();
    const responses = await send(100, "key-a");
    expect(responses).toHaveLength(100);
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ orders: [] });
      expect(res.headers["retry-after"]).toBeUndefined();
    }
  });

  it("[scenario: rate-limiting/First request over the limit is rejected]", async () => {
    const { send } = setup();
    const res = (await send(101, "key-a"))[100];
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "Too Many Requests" });
    expect(res.headers["retry-after"]).toBe("60");
  });

  it("[scenario: rate-limiting/All paths share one counter]", async () => {
    const { send, get } = setup();
    await send(100, "key-a");
    const res = await get("key-a", "/unknown");
    expect(res.statusCode).toBe(429);
  });

  it("[scenario: rate-limiting/Last millisecond of the window is still limited]", async () => {
    const { clock, send, get } = setup();
    await send(100, "key-a");
    clock.set(59_999);
    const res = await get("key-a");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("1");
  });

  it("[scenario: rate-limiting/New window starts exactly at 60 seconds with a full allowance]", async () => {
    const { clock, send } = setup();
    await send(100, "key-a");
    clock.set(60_000);
    const statuses = (await send(101, "key-a")).map((res) => res.statusCode);
    expect(statuses.slice(0, 100)).toEqual(Array(100).fill(200));
    expect(statuses[100]).toBe(429);
  });

  it("[scenario: rate-limiting/Rejected requests do not extend the window]", async () => {
    const { clock, send, get } = setup();
    await send(100, "key-a");
    clock.set(50_000);
    expect((await get("key-a")).statusCode).toBe(429);
    clock.set(60_000);
    expect((await get("key-a")).statusCode).toBe(200);
  });

  it("[scenario: rate-limiting/Partial seconds round up]", async () => {
    const { clock, send, get } = setup();
    await send(100, "key-a");
    clock.set(30_500);
    const res = await get("key-a");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("30");
  });

  it("[scenario: rate-limiting/Each key has its own count and window]", async () => {
    const { clock, send, get } = setup();
    const keyA = await send(100, "key-a");
    clock.set(30_000);
    const keyB = await send(100, "key-b");
    expect([...keyA, ...keyB].map((res) => res.statusCode)).toEqual(Array(200).fill(200));
    clock.set(60_000);
    expect((await get("key-a")).statusCode).toBe(200);
    const res = await get("key-b");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("30");
  });

  it("[scenario: rate-limiting/Keys differing only by case are distinct]", async () => {
    const { send, get } = setup();
    await send(100, "key-a");
    expect((await get("KEY-A")).statusCode).toBe(200);
    expect((await get("key-a")).statusCode).toBe(429);
  });

  it("[scenario: rate-limiting/Missing header passes through]", async () => {
    const { send } = setup();
    for (const res of await send(101)) {
      expect(res.statusCode).toBe(200);
      expect(res.headers["retry-after"]).toBeUndefined();
    }
  });

  it("[scenario: rate-limiting/Empty header passes through]", async () => {
    const { send } = setup();
    for (const res of await send(101, "")) {
      expect(res.statusCode).toBe(200);
      expect(res.headers["retry-after"]).toBeUndefined();
    }
  });

  it("[scenario: rate-limiting/Concurrent requests over the limit]", async () => {
    const { get } = setup();
    const responses = await Promise.all(Array.from({ length: 150 }, () => get("key-a")));
    const rejected = responses.filter((res) => res.statusCode === 429);
    expect(responses.filter((res) => res.statusCode === 200)).toHaveLength(100);
    expect(rejected).toHaveLength(50);
    for (const res of rejected) {
      expect(res.headers["retry-after"]).toBe("60");
    }
  });
});
