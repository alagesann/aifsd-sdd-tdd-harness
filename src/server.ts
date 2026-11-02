import { buildApp } from "./app.ts";

const app = buildApp();
await app.listen({ port: Number(process.env.PORT ?? 3000) });
console.log(`Orders API listening on http://localhost:${process.env.PORT ?? 3000}`);
