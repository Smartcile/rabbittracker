import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BowlDto, RabbitDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("bowl integration", () => {
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

  async function createBowl(
    rabbitId: number,
    startWeightGrams = 900,
    slots: string[] = [],
  ): Promise<BowlDto> {
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, "/api/bowls", {
      method: "POST",
      body: {
        rabbitId,
        label: "Water bowl",
        slots,
        startWeightGrams,
        startedAt: "2026-09-01T08:00:00.000Z",
      },
    });
    return bowl;
  }

  async function addReading(bowlId: number, body: Record<string, unknown>): Promise<BowlDto> {
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, `/api/bowls/${bowlId}/readings`, {
      method: "POST",
      body,
    });
    return bowl;
  }

  async function addReadings(
    bowlId: number,
    readings: Record<string, unknown>[],
  ): Promise<BowlDto> {
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, `/api/bowls/${bowlId}/readings/batch`, {
      method: "POST",
      body: { readings },
    });
    return bowl;
  }

  it("creates a bowl with a start reading", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    expect(bowl.label).toBe("Water bowl");
    expect(bowl.currentWeightGrams).toBe(900);
    expect(bowl.readings).toHaveLength(1);
    expect(bowl.readings[0]?.kind).toBe("start");
    expect(bowl.readings[0]?.periodStart).toBe(true);

    const { bowls } = await api<{ bowls: BowlDto[] }>(ctx, `/api/bowls?rabbitId=${rabbit.id}`);
    expect(bowls).toHaveLength(1);
    expect(bowls[0]?.currentWeightGrams).toBe(900);
  });

  it("rolls consumption forward and treats increases as refills", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    const afterWeigh = await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 760,
    });
    expect(afterWeigh.periodConsumptionGrams).toBe(140);

    const afterRefill = await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T09:00:00.000Z",
      weightGrams: 1000,
    });
    expect(afterRefill.periodConsumptionGrams).toBe(140);
    expect(afterRefill.periodRefillGrams).toBe(240);
    expect(afterRefill.currentWeightGrams).toBe(1000);
  });

  it("adds a refill amount to the current weight", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    const updated = await addReading(bowl.id, {
      kind: "refill",
      readAt: "2026-09-02T08:00:00.000Z",
      refillGrams: 250,
    });
    expect(updated.currentWeightGrams).toBe(1150);
    expect(updated.periodRefillGrams).toBe(250);
    expect(updated.periodConsumptionGrams).toBe(0);
  });

  it("refreshes with a final weight and resets the period", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 600,
    });

    const refreshed = await addReading(bowl.id, {
      kind: "refresh",
      readAt: "2026-09-03T08:00:00.000Z",
      weightGrams: 850,
      finalWeightGrams: 580,
    });
    expect(refreshed.periodStartAt).toBe("2026-09-03T08:00:00.000Z");
    expect(refreshed.periodConsumptionGrams).toBe(0);
    expect(refreshed.totalConsumptionGrams).toBe(320);
    expect(refreshed.currentWeightGrams).toBe(850);
  });

  it("recalculates totals when a reading is deleted", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const middle = await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 700,
    });
    await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-03T08:00:00.000Z",
      weightGrams: 600,
    });

    const middleReading = middle.readings.find((reading) => reading.weightGrams === 700);
    if (!middleReading) throw new Error("middle reading not found");
    const { bowl: after } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings/${middleReading.id}`,
      { method: "DELETE" },
    );
    expect(after.readings).toHaveLength(2);
    expect(after.periodConsumptionGrams).toBe(300);
    expect(after.currentWeightGrams).toBe(600);
  });

  it("schedules a bowl and links readings to a time of day", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id, 900, ["morning", "evening"]);
    expect(bowl.slots).toEqual(["morning", "evening"]);

    const updated = await addReading(bowl.id, {
      kind: "refill",
      readAt: "2026-09-02T08:00:00.000Z",
      refillGrams: 250,
      slot: "morning",
    });
    expect(updated.readings.some((reading) => reading.slot === "morning")).toBe(true);

    const { bowls } = await api<{ bowls: BowlDto[] }>(
      ctx,
      "/api/bowls/schedule?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z",
    );
    expect(bowls).toHaveLength(1);
    expect(bowls[0]?.slots).toEqual(["morning", "evening"]);
    expect(bowls[0]?.readings.some((reading) => reading.slot === "morning")).toBe(true);
  });

  it("keeps unscheduled bowls off the schedule and filters readings by range", async () => {
    const rabbit = await createRabbit();
    await createBowl(rabbit.id);
    const scheduled = await createBowl(rabbit.id, 900, ["night"]);
    await addReading(scheduled.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 800,
      slot: "night",
    });
    await addReading(scheduled.id, {
      kind: "weigh",
      readAt: "2026-10-02T08:00:00.000Z",
      weightGrams: 700,
      slot: "night",
    });

    const { bowls } = await api<{ bowls: BowlDto[] }>(
      ctx,
      "/api/bowls/schedule?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z",
    );
    expect(bowls).toHaveLength(1);
    expect(bowls[0]?.readings).toHaveLength(2);
    expect(bowls[0]?.readings.some((reading) => reading.readAt.startsWith("2026-10-02"))).toBe(
      false,
    );
  });

  it("assigns the only scheduled time when a reading omits it", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id, 900, ["morning"]);
    const updated = await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 800,
    });
    expect(updated.readings.find((reading) => reading.weightGrams === 800)?.slot).toBe("morning");
  });

  it("edits a weigh-in and recalculates consumption", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const afterWeigh = await addReading(bowl.id, {
      kind: "weigh",
      readAt: "2026-09-02T08:00:00.000Z",
      weightGrams: 700,
    });
    expect(afterWeigh.periodConsumptionGrams).toBe(200);
    const reading = afterWeigh.readings.find((row) => row.weightGrams === 700);
    if (!reading) throw new Error("reading not found");

    const { bowl: edited } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings/${reading.id}`,
      { method: "PATCH", body: { weightGrams: 750, notes: "Corrected" } },
    );
    expect(edited.currentWeightGrams).toBe(750);
    expect(edited.periodConsumptionGrams).toBe(150);
    expect(edited.readings.find((row) => row.id === reading.id)?.notes).toBe("Corrected");
  });

  it("edits a top-up and recomputes the stored weight", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const afterRefill = await addReading(bowl.id, {
      kind: "refill",
      readAt: "2026-09-02T08:00:00.000Z",
      refillGrams: 250,
    });
    const reading = afterRefill.readings.find((row) => row.kind === "refill");
    if (!reading) throw new Error("reading not found");
    expect(reading.weightGrams).toBe(1150);

    const { bowl: edited } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings/${reading.id}`,
      { method: "PATCH", body: { refillGrams: 100 } },
    );
    expect(edited.currentWeightGrams).toBe(1000);
    expect(edited.periodRefillGrams).toBe(100);
  });

  it("calculates the new weight from a consumption entry", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const updated = await addReading(bowl.id, {
      kind: "consume",
      readAt: "2026-09-02T08:00:00.000Z",
      consumedGrams: 150,
    });
    expect(updated.currentWeightGrams).toBe(750);
    expect(updated.periodConsumptionGrams).toBe(150);
    expect(updated.readings.some((reading) => reading.kind === "consume")).toBe(true);
  });

  it("rejects consumption larger than the bowl holds", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    await expect(
      addReading(bowl.id, {
        kind: "consume",
        readAt: "2026-09-02T08:00:00.000Z",
        consumedGrams: 5000,
      }),
    ).rejects.toThrow("That is more than the bowl holds");
  });

  it("replaces the amount when editing a top-up that weighed first", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const after = await addReading(bowl.id, {
      kind: "refill",
      readAt: "2026-09-02T08:00:00.000Z",
      refillGrams: 250,
      preWeightGrams: 600,
    });
    const refill = after.readings.find((row) => row.kind === "refill");
    if (!refill) throw new Error("refill not found");
    expect(refill.weightGrams).toBe(850);

    const { bowl: edited } = await api<{ bowl: BowlDto }>(
      ctx,
      `/api/bowls/${bowl.id}/readings/${refill.id}`,
      { method: "PATCH", body: { refillGrams: 100 } },
    );
    expect(edited.currentWeightGrams).toBe(700);
    expect(edited.periodRefillGrams).toBe(100);
    expect(edited.periodConsumptionGrams).toBe(300);
  });

  it("records a weigh-in together with a top-up", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);
    const updated = await addReading(bowl.id, {
      kind: "refill",
      readAt: "2026-09-02T08:00:00.000Z",
      refillGrams: 250,
      preWeightGrams: 600,
    });
    expect(updated.currentWeightGrams).toBe(850);
    expect(updated.periodConsumptionGrams).toBe(300);
    expect(updated.periodRefillGrams).toBe(250);
    expect(updated.readings.some((row) => row.kind === "weigh" && row.weightGrams === 600)).toBe(
      true,
    );
  });

  it("logs several readings in one batch in chronological order", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    const updated = await addReadings(bowl.id, [
      { kind: "weigh", readAt: "2026-09-02T09:00:00.000Z", weightGrams: 700 },
      { kind: "weigh", readAt: "2026-09-02T08:00:00.000Z", weightGrams: 800 },
      { kind: "consume", readAt: "2026-09-02T10:00:00.000Z", consumedGrams: 150 },
      { kind: "refill", readAt: "2026-09-02T11:00:00.000Z", refillGrams: 250 },
    ]);

    expect(updated.readings).toHaveLength(5);
    expect(updated.currentWeightGrams).toBe(800);
    expect(updated.periodConsumptionGrams).toBe(350);
    expect(updated.periodRefillGrams).toBe(250);
  });

  it("deducts product stock for every top-up in a batch", async () => {
    const rabbit = await createRabbit();
    const { product } = await api<{ product: { id: number } }>(ctx, "/api/food-products", {
      method: "POST",
      body: { name: "Timothy hay" },
    });
    await api(ctx, `/api/food-products/${product.id}/entries`, {
      method: "POST",
      body: { amountGrams: 1000 },
    });
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, "/api/bowls", {
      method: "POST",
      body: {
        rabbitId: rabbit.id,
        label: "Hay bowl",
        productId: product.id,
        startWeightGrams: 500,
        startedAt: "2026-09-01T08:00:00.000Z",
      },
    });

    await addReadings(bowl.id, [
      { kind: "refill", readAt: "2026-09-02T08:00:00.000Z", refillGrams: 250 },
      { kind: "refill", readAt: "2026-09-02T09:00:00.000Z", refillGrams: 100 },
    ]);

    const { products } = await api<{ products: { id: number; stockGrams: number }[] }>(
      ctx,
      "/api/food-products",
    );
    expect(products.find((item) => item.id === product.id)?.stockGrams).toBe(650);
  });

  it("rolls back the whole batch when one reading is invalid", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    await expect(
      addReadings(bowl.id, [
        { kind: "weigh", readAt: "2026-09-02T08:00:00.000Z", weightGrams: 800 },
        { kind: "consume", readAt: "2026-09-02T09:00:00.000Z", consumedGrams: 5000 },
      ]),
    ).rejects.toThrow("That is more than the bowl holds");

    const { bowls } = await api<{ bowls: BowlDto[] }>(ctx, `/api/bowls?rabbitId=${rabbit.id}`);
    expect(bowls[0]?.readings).toHaveLength(1);
    expect(bowls[0]?.currentWeightGrams).toBe(900);
  });

  it("stores and updates the bowl kind", async () => {
    const rabbit = await createRabbit();
    const { bowl } = await api<{ bowl: BowlDto }>(ctx, "/api/bowls", {
      method: "POST",
      body: {
        rabbitId: rabbit.id,
        label: "Water bowl",
        kind: "water",
        startWeightGrams: 900,
        startedAt: "2026-09-01T08:00:00.000Z",
      },
    });
    expect(bowl.kind).toBe("water");

    const { bowl: edited } = await api<{ bowl: BowlDto }>(ctx, `/api/bowls/${bowl.id}`, {
      method: "PATCH",
      body: { kind: "food" },
    });
    expect(edited.kind).toBe("food");
  });

  it("renames and deletes a bowl", async () => {
    const rabbit = await createRabbit();
    const bowl = await createBowl(rabbit.id);

    const { bowl: renamed } = await api<{ bowl: BowlDto }>(ctx, `/api/bowls/${bowl.id}`, {
      method: "PATCH",
      body: { label: "Pellets bowl", slots: ["morning"] },
    });
    expect(renamed.label).toBe("Pellets bowl");
    expect(renamed.slots).toEqual(["morning"]);

    await api(ctx, `/api/bowls/${bowl.id}`, { method: "DELETE" });
    const { bowls } = await api<{ bowls: BowlDto[] }>(ctx, `/api/bowls?rabbitId=${rabbit.id}`);
    expect(bowls).toEqual([]);
  });
});
