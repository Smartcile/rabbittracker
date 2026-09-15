import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LookupDto } from "../../../shared/types.ts";
import { api, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("lookup defaults integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it("adds missing default lookups without duplicating them", async () => {
    const { lookups } = await api<{ lookups: LookupDto[] }>(ctx, "/api/lookups");
    for (const lookup of lookups) {
      await api(ctx, `/api/lookups/${lookup.id}`, { method: "DELETE" });
    }

    const first = await api<{ added: string[] }>(ctx, "/api/lookups/defaults", { method: "POST" });
    expect(first.added).toContain("Oral");
    expect(first.added).toContain("Every 12 hours");

    const second = await api<{ added: string[] }>(ctx, "/api/lookups/defaults", { method: "POST" });
    expect(second.added).toEqual([]);

    const { lookups: after } = await api<{ lookups: LookupDto[] }>(ctx, "/api/lookups");
    const routes = after.filter((lookup) => lookup.kind === "route").map((lookup) => lookup.label);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
