import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  BreedNormDto,
  GrowthStageDto,
  RabbitDto,
  RabbitStageCompletionDto,
  SettingsDto,
} from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("growth norms integration", () => {
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
      body: { name: "Clover", dateOfBirth: "2026-01-01", breed: "Dutch" },
    });
    return rabbit;
  }

  it("saves the consumption rates", async () => {
    const { settings } = await api<{ settings: SettingsDto }>(ctx, "/api/settings/norms", {
      method: "PUT",
      body: {
        foodMinGramsPerKg: 25,
        foodMaxGramsPerKg: 70,
        waterMinMilliLitresPerKg: 60,
        waterMaxMilliLitresPerKg: 160,
      },
    });
    expect(settings.foodMinGramsPerKg).toBe(25);
    expect(settings.waterMaxMilliLitresPerKg).toBe(160);
  });

  it("rejects an inverted consumption range", async () => {
    await expect(
      api(ctx, "/api/settings/norms", {
        method: "PUT",
        body: {
          foodMinGramsPerKg: 80,
          foodMaxGramsPerKg: 20,
          waterMinMilliLitresPerKg: 50,
          waterMaxMilliLitresPerKg: 150,
        },
      }),
    ).rejects.toThrow("Food minimum must be below maximum");
  });

  it("adds missing default breed norms without duplicating", async () => {
    const first = await api<{ added: string[] }>(ctx, "/api/breed-norms/defaults", {
      method: "POST",
    });
    expect(first.added).toContain("Dutch");

    const second = await api<{ added: string[] }>(ctx, "/api/breed-norms/defaults", {
      method: "POST",
    });
    expect(second.added).toEqual([]);

    const { norms } = await api<{ norms: BreedNormDto[] }>(ctx, "/api/breed-norms");
    const dutch = norms.find((norm) => norm.breed === "Dutch");
    expect(dutch?.minGrams).toBe(1800);
    expect(dutch?.maxGrams).toBe(2500);
  });

  it("creates and updates a breed norm", async () => {
    const { norm } = await api<{ norm: BreedNormDto }>(ctx, "/api/breed-norms", {
      method: "POST",
      body: { breed: "Continental Giant", minGrams: 6000, maxGrams: 9000 },
    });
    expect(norm.breed).toBe("Continental Giant");

    const { norm: updated } = await api<{ norm: BreedNormDto }>(ctx, `/api/breed-norms/${norm.id}`, {
      method: "PATCH",
      body: { maxGrams: 9500 },
    });
    expect(updated.maxGrams).toBe(9500);
  });

  it("adds and ticks off growth stages", async () => {
    const rabbit = await createRabbit();
    const first = await api<{ added: string[] }>(ctx, "/api/growth-stages/defaults", {
      method: "POST",
    });
    expect(first.added).toContain("Desexing window");

    const { stages } = await api<{ stages: GrowthStageDto[] }>(ctx, "/api/growth-stages");
    const stage = stages.find((row) => row.label === "Weaning");
    if (!stage) throw new Error("stage not found");

    const { completion } = await api<{ completion: RabbitStageCompletionDto }>(
      ctx,
      `/api/rabbits/${rabbit.id}/stages/${stage.id}`,
      { method: "PUT", body: { completedAt: "2026-02-01", notes: "All eating well." } },
    );
    expect(completion.stageId).toBe(stage.id);
    expect(completion.notes).toBe("All eating well.");

    const { rabbit: reloaded } = await api<{ rabbit: RabbitDto; stageCompletions: RabbitStageCompletionDto[] }>(
      ctx,
      `/api/rabbits/${rabbit.id}`,
    );
    expect(reloaded).toBeDefined();
    const bundle = await api<{ stageCompletions: RabbitStageCompletionDto[] }>(
      ctx,
      `/api/rabbits/${rabbit.id}`,
    );
    expect(bundle.stageCompletions).toHaveLength(1);

    await api(ctx, `/api/rabbits/${rabbit.id}/stages/${stage.id}`, { method: "DELETE" });
    const after = await api<{ stageCompletions: RabbitStageCompletionDto[] }>(
      ctx,
      `/api/rabbits/${rabbit.id}`,
    );
    expect(after.stageCompletions).toEqual([]);
  });
});
