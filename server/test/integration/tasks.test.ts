import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  DrugDto,
  MedicationLogDto,
  RabbitDto,
  TaskCompletionDto,
  TaskDto,
  TreatmentDto,
} from "../../../shared/types.ts";
import { api, resetBusinessData, startTestServer } from "./helpers.ts";
import type { TestContext } from "./helpers.ts";

describe("task integration", () => {
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

  async function createTask(rabbitId: number, body: Record<string, unknown> = {}): Promise<TaskDto> {
    const { task } = await api<{ task: TaskDto }>(ctx, "/api/tasks", {
      method: "POST",
      body: { rabbitId, label: "Clean litter", ...body },
    });
    return task;
  }

  async function completeTask(taskId: number): Promise<TaskCompletionDto> {
    const { completion } = await api<{ completion: TaskCompletionDto }>(
      ctx,
      `/api/tasks/${taskId}/complete`,
      { method: "POST", body: { completedAt: "2026-09-15T08:00:00.000Z" } },
    );
    return completion;
  }

  async function createMedicationTask(rabbitId: number): Promise<{ task: TaskDto; drug: DrugDto }> {
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
    const { treatment } = await api<{ treatment: TreatmentDto }>(ctx, "/api/treatments", {
      method: "POST",
      body: {
        rabbitId,
        medication: drug.name,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        drugId: drug.id,
        doseMilliUnits: 667,
      },
    });
    const task = await createTask(rabbitId, {
      label: "Morning meds",
      slot: "morning",
      treatmentId: treatment.id,
    });
    return { task, drug };
  }

  async function stockFor(drugId: number): Promise<number> {
    const { drugs } = await api<{ drugs: DrugDto[] }>(ctx, "/api/drugs");
    const drug = drugs.find((row) => row.id === drugId);
    return drug?.batches.reduce((sum, batch) => sum + batch.quantityMilliUnits, 0) ?? -1;
  }

  it("creates a task and lists it as not yet completed", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id, { slot: "evening", intervalDays: 2 });

    expect(task.slot).toBe("evening");
    expect(task.intervalDays).toBe(2);
    expect(task.lastCompletedAt).toBeNull();

    const { tasks } = await api<{ tasks: TaskDto[] }>(ctx, `/api/tasks?rabbitId=${rabbit.id}`);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.label).toBe("Clean litter");
  });

  it("records a completion and exposes it as the last completion", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id);
    const completion = await completeTask(task.id);

    expect(completion.medicationLogId).toBeNull();

    const { tasks, completions } = await api<{ tasks: TaskDto[]; completions: TaskCompletionDto[] }>(
      ctx,
      `/api/tasks?rabbitId=${rabbit.id}`,
    );
    expect(tasks[0]?.lastCompletedAt).toBe("2026-09-15T08:00:00.000Z");
    expect(completions).toHaveLength(1);
    expect(completions[0]?.taskId).toBe(task.id);
  });

  it("logs a dose and deducts stock when completing a medication task", async () => {
    const rabbit = await createRabbit();
    const { task, drug } = await createMedicationTask(rabbit.id);
    expect(await stockFor(drug.id)).toBe(10000);

    const completion = await completeTask(task.id);
    expect(completion.medicationLogId).not.toBeNull();
    expect(await stockFor(drug.id)).toBe(9333);

    const { logs } = await api<{ logs: MedicationLogDto[] }>(
      ctx,
      `/api/medication-logs?rabbitId=${rabbit.id}`,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.amountMilliUnits).toBe(667);
  });

  it("restores stock when a medication completion is undone", async () => {
    const rabbit = await createRabbit();
    const { task, drug } = await createMedicationTask(rabbit.id);
    const completion = await completeTask(task.id);

    await api(ctx, `/api/tasks/completions/${completion.id}`, { method: "DELETE" });

    expect(await stockFor(drug.id)).toBe(10000);
    const { logs } = await api<{ logs: MedicationLogDto[] }>(
      ctx,
      `/api/medication-logs?rabbitId=${rabbit.id}`,
    );
    expect(logs).toEqual([]);
    const { tasks } = await api<{ tasks: TaskDto[] }>(ctx, `/api/tasks?rabbitId=${rabbit.id}`);
    expect(tasks[0]?.lastCompletedAt).toBeNull();
  });

  it("keeps logged doses when the task is deleted", async () => {
    const rabbit = await createRabbit();
    const { task } = await createMedicationTask(rabbit.id);
    await completeTask(task.id);

    await api(ctx, `/api/tasks/${task.id}`, { method: "DELETE" });

    const { logs } = await api<{ logs: MedicationLogDto[] }>(
      ctx,
      `/api/medication-logs?rabbitId=${rabbit.id}`,
    );
    expect(logs).toHaveLength(1);
    const { tasks } = await api<{ tasks: TaskDto[] }>(ctx, `/api/tasks?rabbitId=${rabbit.id}`);
    expect(tasks).toEqual([]);
  });

  it("pauses a task and rejects an unknown treatment", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id);

    const { task: paused } = await api<{ task: TaskDto }>(ctx, `/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { active: false },
    });
    expect(paused.active).toBe(false);

    await expect(
      api(ctx, "/api/tasks", {
        method: "POST",
        body: { rabbitId: rabbit.id, label: "Bad link", treatmentId: 9999 },
      }),
    ).rejects.toThrow();
  });
});
