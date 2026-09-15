import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  DrugBatchDto,
  DrugDto,
  MedicationLogDto,
  RabbitDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { DRUG_SEED } from "../../src/lib/drugSeedData.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("drug stock integration", () => {
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
      body: { name: "Thumper" },
    });
    return rabbit;
  }

  async function createDrug(overrides: Record<string, unknown> = {}): Promise<DrugDto> {
    const { drug } = await api<{ drug: DrugDto }>(ctx, "/api/drugs", {
      method: "POST",
      body: {
        name: "Meloxicam oral suspension",
        unit: "ml",
        concentrationMicrogramsPerUnit: 1500,
        doseMicrogramsPerKg: 500,
        dosesPerDay: 2,
        ...overrides,
      },
    });
    return drug;
  }

  async function addBatch(
    drugId: number,
    quantityMilliUnits: number,
    expiryDate: string | null = null,
  ): Promise<DrugBatchDto> {
    const { batch } = await api<{ batch: DrugBatchDto }>(ctx, `/api/drugs/${drugId}/batches`, {
      method: "POST",
      body: { quantityMilliUnits, expiryDate },
    });
    return batch;
  }

  async function getDrug(id: number): Promise<DrugDto> {
    const { drugs } = await api<{ drugs: DrugDto[] }>(ctx, "/api/drugs");
    const drug = drugs.find((row) => row.id === id);
    if (!drug) throw new Error(`Drug ${id} not found`);
    return drug;
  }

  async function createTreatment(
    rabbitId: number,
    drug: DrugDto,
    doseMilliUnits: number,
    endDate: string | null = "2026-01-05",
  ): Promise<TreatmentDto> {
    const { treatment } = await api<{ treatment: TreatmentDto }>(ctx, "/api/treatments", {
      method: "POST",
      body: {
        rabbitId,
        medication: drug.name,
        startDate: "2026-01-01",
        endDate,
        drugId: drug.id,
        doseMilliUnits,
      },
    });
    return treatment;
  }

  async function patchTreatment(id: number, body: Record<string, unknown>): Promise<TreatmentDto> {
    const { treatment } = await api<{ treatment: TreatmentDto }>(ctx, `/api/treatments/${id}`, {
      method: "PATCH",
      body,
    });
    return treatment;
  }

  async function logDose(
    rabbitId: number,
    body: Record<string, unknown>,
  ): Promise<MedicationLogDto> {
    const { log } = await api<{ log: MedicationLogDto }>(ctx, "/api/medication-logs", {
      method: "POST",
      body: { rabbitId, givenAt: "2026-01-02T08:00:00.000Z", ...body },
    });
    return log;
  }

  it("requires authentication", async () => {
    const response = await fetch(`${ctx.baseUrl}/api/drugs`);
    expect(response.status).toBe(401);
  });

  it("adds missing starter drugs on demand without duplicating them", async () => {
    const { added } = await api<{ added: string[] }>(ctx, "/api/drugs/defaults", { method: "POST" });
    expect(added).toContain("Doxy 100 paste (100 mg/ml)");
    expect(added).toContain("Trimethoprim Sulfa 240 mg/5 ml (Deprim)");
    const { drugs } = await api<{ drugs: DrugDto[] }>(ctx, "/api/drugs");
    const names = drugs.map((drug) => drug.name);
    expect(new Set(names).size).toBe(names.length);
    const again = await api<{ added: string[] }>(ctx, "/api/drugs/defaults", { method: "POST" });
    expect(again.added).toEqual([]);
  });

  it("does not re-add a starter drug that exists under another name", async () => {
    await createDrug({
      name: "My meloxicam",
      activeIngredient: "meloxicam",
      form: "liquid",
      unit: "ml",
      concentrationMicrogramsPerUnit: 1500,
      doseMicrogramsPerKg: 500,
    });
    const { added } = await api<{ added: string[] }>(ctx, "/api/drugs/defaults", { method: "POST" });
    expect(added).not.toContain("Meloxicam oral suspension (Metacam)");
    expect(added).toHaveLength(DRUG_SEED.length - 1);
  });

  it("does not deduct stock when a treatment is created", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const treatment = await createTreatment(rabbit.id, drug, 667);
    expect(treatment.stockDeductedMilliUnits).toBe(0);
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(10000);
  });

  it("does not touch stock when the course changes or the treatment is deleted", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const treatment = await createTreatment(rabbit.id, drug, 667);
    const patched = await patchTreatment(treatment.id, { endDate: "2026-01-03" });
    expect(patched.stockDeductedMilliUnits).toBe(0);
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(10000);
    await api(ctx, `/api/treatments/${treatment.id}`, { method: "DELETE" });
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(10000);
  });

  it("switches the treatment drug without touching stock", async () => {
    const rabbit = await createRabbit();
    const first = await createDrug();
    const second = await createDrug({ name: "Enrofloxacin", dosesPerDay: 2 });
    await addBatch(first.id, 10000);
    await addBatch(second.id, 5000);
    const treatment = await createTreatment(rabbit.id, first, 667);
    const patched = await patchTreatment(treatment.id, {
      drugId: second.id,
      doseMilliUnits: 100,
    });
    expect(patched.drugId).toBe(second.id);
    expect((await getDrug(first.id)).batches[0].quantityMilliUnits).toBe(10000);
    expect((await getDrug(second.id)).batches[0].quantityMilliUnits).toBe(5000);
  });

  it("deducts a logged dose from the earliest expiry first", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 500, "2026-01-01");
    await addBatch(drug.id, 1000, "2026-02-01");
    await logDose(rabbit.id, { drugId: drug.id, amountMilliUnits: 1200 });
    const updated = await getDrug(drug.id);
    const byExpiry = new Map(
      updated.batches.map((batch) => [batch.expiryDate, batch.quantityMilliUnits]),
    );
    expect(byExpiry.get("2026-01-01")).toBe(0);
    expect(byExpiry.get("2026-02-01")).toBe(300);
  });

  it("clamps a logged dose to available stock", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 1000);
    await logDose(rabbit.id, { drugId: drug.id, amountMilliUnits: 6670 });
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(0);
  });

  it("resolves the drug and dose from a linked treatment", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const treatment = await createTreatment(rabbit.id, drug, 667);
    const log = await logDose(rabbit.id, { treatmentId: treatment.id });
    expect(log.drugId).toBe(drug.id);
    expect(log.amountMilliUnits).toBe(667);
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(9333);
  });

  it("restores stock when a dose log is deleted", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const log = await logDose(rabbit.id, { drugId: drug.id, amountMilliUnits: 2000 });
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(8000);
    await api(ctx, `/api/medication-logs/${log.id}`, { method: "DELETE" });
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(10000);
  });

  it("clears the dose when the drug link is removed", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const treatment = await createTreatment(rabbit.id, drug, 667);
    const patched = await patchTreatment(treatment.id, { drugId: null });
    expect(patched.drugId).toBeNull();
    expect(patched.doseMilliUnits).toBeNull();
    expect(patched.stockDeductedMilliUnits).toBe(0);
    expect((await getDrug(drug.id)).batches[0].quantityMilliUnits).toBe(10000);
  });

  it("clears the treatment link when the drug is deleted", async () => {
    const rabbit = await createRabbit();
    const drug = await createDrug();
    await addBatch(drug.id, 10000);
    const treatment = await createTreatment(rabbit.id, drug, 667);
    await api(ctx, `/api/drugs/${drug.id}`, { method: "DELETE" });
    const { treatments } = await api<{ treatments: TreatmentDto[] }>(ctx, "/api/treatments");
    const reloaded = treatments.find((row) => row.id === treatment.id);
    expect(reloaded?.drugId).toBeNull();
    const { drugs } = await api<{ drugs: DrugDto[] }>(ctx, "/api/drugs");
    expect(drugs).toHaveLength(0);
  });

  it("rejects a treatment linked to an unknown drug", async () => {
    const rabbit = await createRabbit();
    await expect(
      api(ctx, "/api/treatments", {
        method: "POST",
        body: {
          rabbitId: rabbit.id,
          medication: "Mystery",
          startDate: "2026-01-01",
          drugId: 99999,
          doseMilliUnits: 100,
        },
      }),
    ).rejects.toThrow("Drug not found");
  });

  it("updates and removes stock batches", async () => {
    const drug = await createDrug();
    const batch = await addBatch(drug.id, 1000);
    const { batch: updated } = await api<{ batch: DrugBatchDto }>(
      ctx,
      `/api/drugs/batches/${batch.id}`,
      { method: "PATCH", body: { quantityMilliUnits: 2500, expiryDate: "2027-01-01" } },
    );
    expect(updated.quantityMilliUnits).toBe(2500);
    expect(updated.expiryDate).toBe("2027-01-01");
    await api(ctx, `/api/drugs/batches/${batch.id}`, { method: "DELETE" });
    expect((await getDrug(drug.id)).batches).toEqual([]);
  });
});
