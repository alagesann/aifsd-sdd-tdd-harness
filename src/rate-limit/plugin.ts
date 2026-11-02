import type { FastifyInstance } from "fastify";
import type { Clock } from "./clock.ts";
import { RATE_LIMIT, decide } from "./policy.ts";
import type { RateLimitStore } from "./store.ts";

export function registerRateLimit(app: FastifyInstance, { store, clock }: { store: RateLimitStore; clock: Clock }) {
  app.addHook("onRequest", async (request, reply) => {
    const key = request.headers["x-api-key"];
    if (typeof key !== "string" || key === "") {
      return;
    }
    const now = clock.now();
    const decision = decide(await store.hit(key, now, RATE_LIMIT.windowMs), now);
    if (!decision.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(decision.retryAfterSeconds))
        .send({ error: "Too Many Requests" });
    }
  });
}
