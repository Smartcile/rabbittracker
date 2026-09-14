import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CheckLogTypeDto, HealthCheckDto, RabbitDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("check integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetBusinessData();
  });

  async function createRabbit(): Promise<RabbitDto> {
    const { rabbit } = await api<{ rabbit: RabbitDto }>(ctx, "/api/rabbits", {
      method: "POST",
      body: { name: "Clover" },
    });
    return rabbit;
  }

  async function createType(body: Record<string, unknown>): Promise<CheckLogTypeDto> {
    const { type } = await api<{ type: CheckLogTypeDto }>(ctx, "/api/check-logs/types", {
      method: "POST",
      body,
    });
    return type;
  }

  async function createCheck(
    rabbitId: number,
    checklist: Record<string, unknown>,
  ): Promise<HealthCheckDto> {
    const { check } = await api<{ check: HealthCheckDto }>(ctx, "/api/checks", {
      method: "POST",
      body: { rabbitId, checkedAt: "2026-09-13T09:00:00.000Z", checklist },
    });
    return check;
  }

  it("stores daily check answers on a health check", async () => {
    const rabbit = await createRabbit();
    const poo = await createType({ label: "Poo", hasNumber: false, options: ["Normal", "Soft"] });

    const check = await createCheck(rabbit.id, {
      [`daily:${poo.key}`]: { values: ["Normal"], other: "" },
    });
    expect(check.checklist[`daily:${poo.key}`]?.values).toEqual(["Normal"]);

    const { checks } = await api<{ checks: HealthCheckDto[] }>(
      ctx,
      `/api/checks?rabbitId=${rabbit.id}`,
    );
    expect(checks[0]?.checklist[`daily:${poo.key}`]?.values).toEqual(["Normal"]);
  });

  it("stores amounts and free text from daily types", async () => {
    const rabbit = await createRabbit();
    const water = await createType({ label: "Water intake", unit: "ml", hasNumber: true, hasText: false });
    const food = await createType({ label: "Food", unit: "g", hasNumber: false, hasText: true });

    const check = await createCheck(rabbit.id, {
      [`daily:${water.key}`]: { values: [], other: "", numberMilli: 250000 },
      [`daily:${food.key}`]: { values: [], other: "", text: "Ate all pellets" },
    });
    expect(check.checklist[`daily:${water.key}`]?.numberMilli).toBe(250000);
    expect(check.checklist[`daily:${food.key}`]?.text).toBe("Ate all pellets");
  });

  it("rejects unknown daily types", async () => {
    const rabbit = await createRabbit();
    await expect(
      createCheck(rabbit.id, { "daily:ghost": { values: ["Boo"], other: "" } }),
    ).rejects.toThrow();
  });

  it("rejects options that the daily type does not define", async () => {
    const rabbit = await createRabbit();
    const poo = await createType({ label: "Poo", hasNumber: false, options: ["Normal"] });
    await expect(
      createCheck(rabbit.id, { [`daily:${poo.key}`]: { values: ["Runny"], other: "" } }),
    ).rejects.toThrow();
  });

  it("rejects an amount on a type without numbers", async () => {
    const rabbit = await createRabbit();
    const poo = await createType({ label: "Poo", hasNumber: false, options: ["Normal"] });
    await expect(
      createCheck(rabbit.id, { [`daily:${poo.key}`]: { values: [], other: "", numberMilli: 5 } }),
    ).rejects.toThrow();
  });
});
