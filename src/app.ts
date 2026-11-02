import Fastify from "fastify";

export function buildApp() {
  const app = Fastify();
  app.get("/orders", async () => ({ orders: [] }));
  return app;
}
