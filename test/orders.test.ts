import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";

describe("orders", () => {
  it("lists orders", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/orders" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ orders: [] });
  });
});
