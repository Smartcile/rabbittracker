import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  BowlDto,
  CheckLogDto,
  MedicationLogDto,
  RabbitDto,
  TaskCompletionDto,
  TaskDto,
} from "../../../shared/types.ts";
import { api, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

const TYPE_KEYS = ["poo", "water", "food", "behaviour"];

describe("demo mode integration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
    const { db } = await import("../../src/db/index.ts");
    const { checkLogTypes, drugs } = await import("../../src/db/schema.ts");
    await db
      .insert(checkLogTypes)
      .values([
        { key: "poo", label: "Poo", hasNumber: false, options: ["Normal", "Soft"] },
        { key: "water", label: "Water intake", unit: "ml" },
        { key: "food", label: "Food", unit: "g", hasText: true },
        {
          key: "behaviour",
          label: "Behaviour",
          hasNumber: false,
          multiple: true,
          options: ["Binkies", "Exploring", "Quiet", "Hiding", "Active"],
        },
      ])
      .onConflictDoNothing();
    await db.insert(drugs).values({
      name: "Meloxicam oral suspension (Metacam)",
      activeIngredient: "meloxicam",
      unit: "ml",
    });
  });

  afterAll(async () => {
    const { disableDemoData } = await import("../../src/lib/demoSeed.ts");
    await disableDemoData();
    const { db } = await import("../../src/db/index.ts");
    const { checkLogTypes, drugs } = await import("../../src/db/schema.ts");
    await db.delete(checkLogTypes).where(inArray(checkLogTypes.key, TYPE_KEYS));
    await db.delete(drugs).where(eq(drugs.activeIngredient, "meloxicam"));
    await ctx.close();
  });

  it("seeds daily checks, doses, bowls and tasks, and removes them on disable", async () => {
    await api(ctx, "/api/settings/demo", { method: "PUT", body: { enabled: true } });
    const { rabbits } = await api<{ rabbits: RabbitDto[] }>(ctx, "/api/rabbits");
    expect(rabbits).toHaveLength(3);
    const clover = rabbits.find((rabbit) => rabbit.name === "Clover");
    if (!clover) throw new Error("Clover missing from demo data");

    const { logs } = await api<{ logs: CheckLogDto[] }>(
      ctx,
      `/api/check-logs?rabbitId=${clover.id}`,
    );
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs.some((log) => log.valueLabels.length >= 2)).toBe(true);

    const { logs: doses } = await api<{ logs: MedicationLogDto[] }>(
      ctx,
      `/api/medication-logs?rabbitId=${clover.id}`,
    );
    expect(doses.length).toBeGreaterThanOrEqual(3);
    expect(doses.every((dose) => dose.drugId !== null && dose.amountMilliUnits === 300)).toBe(true);

    const { bowls } = await api<{ bowls: BowlDto[] }>(ctx, `/api/bowls?rabbitId=${clover.id}`);
    expect(bowls.length).toBeGreaterThanOrEqual(1);
    expect(bowls[0].readings.length).toBeGreaterThanOrEqual(4);
    expect(bowls[0].currentWeightGrams).not.toBeNull();
    expect(bowls[0].totalConsumptionGrams).toBeGreaterThan(0);

    const { tasks, completions } = await api<{
      tasks: TaskDto[];
      completions: TaskCompletionDto[];
    }>(ctx, `/api/tasks?rabbitId=${clover.id}`);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(completions.length).toBeGreaterThanOrEqual(1);

    await api(ctx, "/api/settings/demo", { method: "PUT", body: { enabled: false } });
    const after = await api<{ rabbits: RabbitDto[] }>(ctx, "/api/rabbits");
    expect(after.rabbits).toHaveLength(0);
  });
});
