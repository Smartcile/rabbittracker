import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RabbitDto, TaskCompletionDto, TaskDto } from "../../../shared/types.ts";
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

    const { tasks, completions } = await api<{ tasks: TaskDto[]; completions: TaskCompletionDto[] }>(
      ctx,
      `/api/tasks?rabbitId=${rabbit.id}`,
    );
    expect(tasks[0]?.lastCompletedAt).toBe("2026-09-15T08:00:00.000Z");
    expect(completions).toHaveLength(1);
    expect(completions[0]?.taskId).toBe(task.id);
  });

  it("undoes a completion", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id);
    const completion = await completeTask(task.id);

    await api(ctx, `/api/tasks/completions/${completion.id}`, { method: "DELETE" });

    const { tasks } = await api<{ tasks: TaskDto[] }>(ctx, `/api/tasks?rabbitId=${rabbit.id}`);
    expect(tasks[0]?.lastCompletedAt).toBeNull();
  });

  it("deletes a task with its completions", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id);
    await completeTask(task.id);

    await api(ctx, `/api/tasks/${task.id}`, { method: "DELETE" });

    const { tasks, completions } = await api<{ tasks: TaskDto[]; completions: TaskCompletionDto[] }>(
      ctx,
      `/api/tasks?rabbitId=${rabbit.id}`,
    );
    expect(tasks).toEqual([]);
    expect(completions).toEqual([]);
  });

  it("pauses a task", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id);

    const { task: paused } = await api<{ task: TaskDto }>(ctx, `/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { active: false },
    });
    expect(paused.active).toBe(false);
  });
});
