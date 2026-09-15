import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DrugDto, MedicationLogDto, RabbitDto, TreatmentDto } from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("treatment slots integration", () => {
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

  async function createDrug(): Promise<DrugDto> {
    const { drug } = await api<{ drug: DrugDto }>(ctx, "/api/drugs", {
      method: "POST",
      body: {
        name: "Meloxicam oral suspension",
        unit: "ml",
        concentrationMicrogramsPerUnit: 1500,
        doseMicrogramsPerKg: 500,
        dosesPerDay: 2,
      },
    });
    await api(ctx, `/api/drugs/${drug.id}/batches`, {
      method: "POST",
      body: { quantityMilliUnits: 10000 },
    });
    return drug;
  }

  async function createTreatment(
    rabbitId: number,
    body: Record<string, unknown> = {},
  ): Promise<TreatmentDto> {
    const { treatment } = await api<{ treatment: TreatmentDto }>(ctx, "/api/treatments", {
      method: "POST",
      body: {
        rabbitId,
        medication: "Meloxicam",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        ...body,
      },
    });
    return treatment;
  }

  async function logDose(body: Record<string, unknown>): Promise<MedicationLogDto> {
    const { log } = await api<{ log: MedicationLogDto }>(ctx, "/api/medication-logs", {
      method: "POST",
      body: { givenAt: "2026-09-02T08:00:00.000Z", ...body },
    });
    return log;
  }

  async function stockFor(drugId: number): Promise<number> {
    const { drugs } = await api<{ drugs: DrugDto[] }>(ctx, "/api/drugs");
    const drug = drugs.find((row) => row.id === drugId);
    return drug?.batches.reduce((sum, batch) => sum + batch.quantityMilliUnits, 0) ?? -1;
  }

  it("stores and returns time slots on a treatment", async () => {
    const rabbit = await createRabbit();
    const treatment = await createTreatment(rabbit.id, { slots: ["early_morning", "evening"] });
    expect(treatment.slots).toEqual(["early_morning", "evening"]);

    const { treatments } = await api<{ treatments: TreatmentDto[] }>(
      ctx,
      `/api/treatments?rabbitId=${rabbit.id}`,
    );
    expect(treatments[0]?.slots).toEqual(["early_morning", "evening"]);
  });

  it("logs a dose for a treatment slot and rejects an unknown slot", async () => {
    const rabbit = await createRabbit();
    const treatment = await createTreatment(rabbit.id, { slots: ["morning", "evening"] });
    const log = await logDose({ rabbitId: rabbit.id, treatmentId: treatment.id, slot: "morning" });
    expect(log.slot).toBe("morning");

    await expect(
      logDose({ rabbitId: rabbit.id, treatmentId: treatment.id, slot: "night" }),
    ).rejects.toThrow("That time of day is not part of this treatment");
  });

  it("assigns the only slot when a dose omits it", async () => {
    const rabbit = await createRabbit();
    const treatment = await createTreatment(rabbit.id, { slots: ["morning"] });
    const log = await logDose({ rabbitId: rabbit.id, treatmentId: treatment.id });
    expect(log.slot).toBe("morning");
  });

  it("rejects a slot without a linked treatment", async () => {
    const rabbit = await createRabbit();
    await expect(logDose({ rabbitId: rabbit.id, slot: "morning" })).rejects.toThrow(
      "A time of day needs a linked treatment",
    );
  });

  it("filters dose logs by date range", async () => {
    const rabbit = await createRabbit();
    const treatment = await createTreatment(rabbit.id);
    for (const givenAt of [
      "2026-09-01T08:00:00.000Z",
      "2026-09-15T08:00:00.000Z",
      "2026-10-01T08:00:00.000Z",
    ]) {
      await logDose({ rabbitId: rabbit.id, treatmentId: treatment.id, givenAt });
    }
    const { logs } = await api<{ logs: MedicationLogDto[] }>(
      ctx,
      "/api/medication-logs?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z",
    );
    expect(logs).toHaveLength(2);
  });

  it("edits a dose log and reconciles drug stock", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    const treatment = await createTreatment(rabbit.id, {
      drugId: drug.id,
      doseMilliUnits: 667,
      slots: ["morning", "evening"],
    });
    const log = await logDose({ rabbitId: rabbit.id, treatmentId: treatment.id, slot: "morning" });
    expect(log.amountMilliUnits).toBe(667);
    expect(await stockFor(drug.id)).toBe(9333);

    const { log: updated } = await api<{ log: MedicationLogDto }>(
      ctx,
      `/api/medication-logs/${log.id}`,
      { method: "PATCH", body: { amountMilliUnits: 1000, slot: "evening", notes: "Corrected" } },
    );
    expect(updated.amountMilliUnits).toBe(1000);
    expect(updated.slot).toBe("evening");
    expect(updated.notes).toBe("Corrected");
    expect(await stockFor(drug.id)).toBe(9000);
  });

  it("rejects moving a dose to a slot the treatment does not use", async () => {
    const rabbit = await createRabbit();
    const treatment = await createTreatment(rabbit.id, { slots: ["morning"] });
    const log = await logDose({ rabbitId: rabbit.id, treatmentId: treatment.id, slot: "morning" });

    await expect(
      api(ctx, `/api/medication-logs/${log.id}`, {
        method: "PATCH",
        body: { slot: "evening" },
      }),
    ).rejects.toThrow("That time of day is not part of this treatment");
  });
});
