import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { taskCompletionToDto, taskToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { rabbitTasks, taskCompletions, foodProducts, foodStockEntries } from "../db/schema.ts";
import type { RabbitTaskRow, TaskCompletionRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { taskCompleteSchema, taskCreateSchema, taskUpdateSchema } from "../lib/validation.ts";

export const tasksRouter = Router();

tasksRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(rabbitTasks.rabbitId, visibleRabbitIds(req.user!)));
  }
  const rabbitId = Number(req.query.rabbitId);
  if (Number.isInteger(rabbitId) && rabbitId > 0) conditions.push(eq(rabbitTasks.rabbitId, rabbitId));
  const rows = await db
    .select()
    .from(rabbitTasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(rabbitTasks.id));
  const taskIds = rows.map((row) => row.id);
  const [lastRows, recent] =
    taskIds.length > 0
      ? await Promise.all([
          db
            .select({ taskId: taskCompletions.taskId, last: max(taskCompletions.completedAt) })
            .from(taskCompletions)
            .where(inArray(taskCompletions.taskId, taskIds))
            .groupBy(taskCompletions.taskId),
          db
            .select()
            .from(taskCompletions)
            .where(inArray(taskCompletions.taskId, taskIds))
            .orderBy(desc(taskCompletions.completedAt), desc(taskCompletions.id))
            .limit(100),
        ])
      : [[], []];
  const lastByTask = new Map(lastRows.map((row) => [row.taskId, row.last]));
  const rabbitByTask = new Map(rows.map((row) => [row.id, row.rabbitId]));
  const names = await productNames(rows.map((row) => row.productId));
  res.json({
    tasks: rows.map((row) =>
      taskToDto(
        row,
        lastByTask.get(row.id) ?? null,
        row.productId !== null ? (names.get(row.productId) ?? null) : null,
      ),
    ),
    completions: recent.map((row) => taskCompletionToDto(row, rabbitByTask.get(row.taskId) ?? 0)),
  });
});

tasksRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(taskCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [row] = await db
    .insert(rabbitTasks)
    .values({
      rabbitId: input.rabbitId,
      templateId: input.templateId ?? null,
      label: input.label,
      slot: input.slot,
      intervalDays: input.intervalDays,
      startDate: input.startDate ?? null,
      productId: input.productId ?? null,
      amountGrams: input.amountGrams,
      notes: input.notes,
      active: input.active,
    })
    .returning();
  res.status(201).json({ task: taskToDto(row, null, await productName(row.productId)) });
});

tasksRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const task = await findTask(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, task.rabbitId);
  const input = parseInput(taskUpdateSchema, req.body);
  const [row] = await db
    .update(rabbitTasks)
    .set({
      label: input.label ?? task.label,
      slot: input.slot ?? task.slot,
      intervalDays: input.intervalDays ?? task.intervalDays,
      startDate: input.startDate !== undefined ? input.startDate : task.startDate,
      productId: input.productId !== undefined ? input.productId : task.productId,
      amountGrams: input.amountGrams ?? task.amountGrams,
      notes: input.notes !== undefined ? input.notes : task.notes,
      active: input.active !== undefined ? input.active : task.active,
      updatedAt: new Date(),
    })
    .where(eq(rabbitTasks.id, task.id))
    .returning();
  res.json({ task: taskToDto(row, await lastCompletion(task.id), await productName(row.productId)) });
});

tasksRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const task = await findTask(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, task.rabbitId);
  await db.delete(rabbitTasks).where(eq(rabbitTasks.id, task.id));
  res.json({ ok: true });
});

tasksRouter.post("/:id/complete", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const task = await findTask(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, task.rabbitId);
  const input = parseInput(taskCompleteSchema, req.body);
  const completion = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(taskCompletions)
      .values({
        taskId: task.id,
        completedAt: input.completedAt,
        completedBy: req.user!.id,
        notes: input.notes,
      })
      .returning();
    if (task.productId !== null && task.amountGrams > 0) {
      await tx.insert(foodStockEntries).values({
        productId: task.productId,
        taskCompletionId: row.id,
        amountGrams: -task.amountGrams,
        note: `Task: ${task.label}`,
      });
    }
    return row;
  });
  res.status(201).json({
    completion: taskCompletionToDto(completion, task.rabbitId),
    task: taskToDto(task, completion.completedAt, await productName(task.productId)),
  });
});

tasksRouter.delete(
  "/completions/:id",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const completion = await findCompletion(parseId(String(req.params.id)));
    const task = await findTask(completion.taskId);
    await findVisibleRabbit(req.user!, task.rabbitId);
    await db.delete(taskCompletions).where(eq(taskCompletions.id, completion.id));
    res.json({ ok: true });
  },
);

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Task not found");
  return id;
}

async function findTask(id: number): Promise<RabbitTaskRow> {
  const rows = await db.select().from(rabbitTasks).where(eq(rabbitTasks.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Task not found");
  return rows[0];
}

async function findCompletion(id: number): Promise<TaskCompletionRow> {
  const rows = await db.select().from(taskCompletions).where(eq(taskCompletions.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Completion not found");
  return rows[0];
}

async function lastCompletion(taskId: number): Promise<Date | null> {
  const rows = await db
    .select({ completedAt: taskCompletions.completedAt })
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, taskId))
    .orderBy(desc(taskCompletions.completedAt))
    .limit(1);
  return rows[0]?.completedAt ?? null;
}

async function productName(productId: number | null): Promise<string | null> {
  if (productId === null) return null;
  const rows = await db
    .select({ name: foodProducts.name })
    .from(foodProducts)
    .where(eq(foodProducts.id, productId))
    .limit(1);
  return rows[0]?.name ?? null;
}

async function productNames(ids: (number | null)[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => id !== null))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: foodProducts.id, name: foodProducts.name })
    .from(foodProducts)
    .where(inArray(foodProducts.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
}
