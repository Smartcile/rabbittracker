import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FoodProductDto, RabbitDto, TaskCompletionDto, TaskDto, TaskTemplateDto } from "../../../shared/types.ts";
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

  it("stores a start date and can clear it", async () => {
    const rabbit = await createRabbit();
    const task = await createTask(rabbit.id, { startDate: "2026-10-01" });
    expect(task.startDate).toBe("2026-10-01");

    const { task: cleared } = await api<{ task: TaskDto }>(ctx, `/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { startDate: "" },
    });
    expect(cleared.startDate).toBeNull();
  });

  async function createProduct(name: string, stockGrams: number): Promise<number> {
    const { product } = await api<{ product: FoodProductDto }>(ctx, "/api/food-products", {
      method: "POST",
      body: { name },
    });
    await api(ctx, `/api/food-products/${product.id}/entries`, {
      method: "POST",
      body: { amountGrams: stockGrams },
    });
    return product.id;
  }

  async function getProduct(id: number): Promise<FoodProductDto> {
    const { products } = await api<{ products: FoodProductDto[] }>(ctx, "/api/food-products");
    const product = products.find((item) => item.id === id);
    if (!product) throw new Error("product not found");
    return product;
  }

  it("creates and edits a routine task template", async () => {
    const { template } = await api<{ template: TaskTemplateDto }>(ctx, "/api/task-templates", {
      method: "POST",
      body: { label: "Change litter box", slot: "evening", intervalDays: 3 },
    });
    expect(template.label).toBe("Change litter box");
    expect(template.intervalDays).toBe(3);

    const { template: edited } = await api<{ template: TaskTemplateDto }>(
      ctx,
      `/api/task-templates/${template.id}`,
      { method: "PATCH", body: { intervalDays: 7 } },
    );
    expect(edited.intervalDays).toBe(7);

    const { templates } = await api<{ templates: TaskTemplateDto[] }>(ctx, "/api/task-templates");
    expect(templates.some((item) => item.id === template.id)).toBe(true);
  });

  it("draws stock when completing a linked task and restores it when undone", async () => {
    const rabbit = await createRabbit();
    const litterId = await createProduct("Litter", 5000);
    const deodoriserId = await createProduct("Deodoriser", 1000);
    const task = await createTask(rabbit.id, {
      products: [
        { productId: litterId, amountGrams: 800 },
        { productId: deodoriserId, amountGrams: 50 },
      ],
    });
    expect(task.products).toHaveLength(2);
    expect(task.products[0]).toMatchObject({
      productId: litterId,
      productName: "Litter",
      amountGrams: 800,
    });

    const completion = await completeTask(task.id);
    expect((await getProduct(litterId)).stockGrams).toBe(4200);
    expect((await getProduct(deodoriserId)).stockGrams).toBe(950);

    await api(ctx, `/api/tasks/completions/${completion.id}`, { method: "DELETE" });
    expect((await getProduct(litterId)).stockGrams).toBe(5000);
    expect((await getProduct(deodoriserId)).stockGrams).toBe(1000);
  });
});
