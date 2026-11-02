import Fastify from "fastify";
import { systemClock, type Clock } from "./rate-limit/clock.ts";
import { InMemoryRateLimitStore } from "./rate-limit/memory-store.ts";
import { registerRateLimit } from "./rate-limit/plugin.ts";
import type { RateLimitStore } from "./rate-limit/store.ts";

export function buildApp({
  store = new InMemoryRateLimitStore(),
  clock = systemClock,
}: { store?: RateLimitStore; clock?: Clock } = {}) {
  const app = Fastify();
  registerRateLimit(app, { store, clock });
  app.get("/orders", async () => ({ orders: [] }));
  return app;
}
