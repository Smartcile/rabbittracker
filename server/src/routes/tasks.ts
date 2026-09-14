import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { taskCompletionToDto, taskToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { medicationLogs, rabbitTasks, taskCompletions, treatments } from "../db/schema.ts";
import type { RabbitTaskRow, TaskCompletionRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { taskCompleteSchema, taskCreateSchema, taskUpdateSchema } from "../lib/validation.ts";
import { deductDrugStock, restoreDrugStock } from "../services/drugStock.ts";

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
  res.json({
    tasks: rows.map((row) => taskToDto(row, lastByTask.get(row.id) ?? null)),
    completions: recent.map((row) => taskCompletionToDto(row, rabbitByTask.get(row.taskId) ?? 0)),
  });
});

tasksRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(taskCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  await requireTreatment(input.rabbitId, input.treatmentId ?? null);
  const [row] = await db
    .insert(rabbitTasks)
    .values({
      rabbitId: input.rabbitId,
      label: input.label,
      slot: input.slot,
      intervalDays: input.intervalDays,
      treatmentId: input.treatmentId ?? null,
      notes: input.notes,
      active: input.active,
    })
    .returning();
  res.status(201).json({ task: taskToDto(row, null) });
});

tasksRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const task = await findTask(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, task.rabbitId);
  const input = parseInput(taskUpdateSchema, req.body);
  if (input.treatmentId !== undefined) await requireTreatment(task.rabbitId, input.treatmentId);
  const [row] = await db
    .update(rabbitTasks)
    .set({
      label: input.label ?? task.label,
      slot: input.slot ?? task.slot,
      intervalDays: input.intervalDays ?? task.intervalDays,
      treatmentId: input.treatmentId !== undefined ? input.treatmentId : task.treatmentId,
      notes: input.notes !== undefined ? input.notes : task.notes,
      active: input.active !== undefined ? input.active : task.active,
      updatedAt: new Date(),
    })
    .where(eq(rabbitTasks.id, task.id))
    .returning();
  res.json({ task: taskToDto(row, await lastCompletion(task.id)) });
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
    let medicationLogId: number | null = null;
    if (task.treatmentId !== null) {
      const treatmentRows = await tx
        .select()
        .from(treatments)
        .where(eq(treatments.id, task.treatmentId))
        .limit(1);
      const treatment = treatmentRows[0];
      if (treatment && treatment.rabbitId === task.rabbitId) {
        let deducted = 0;
        if (
          treatment.drugId !== null &&
          treatment.doseMilliUnits !== null &&
          treatment.doseMilliUnits > 0
        ) {
          deducted = await deductDrugStock(tx, treatment.drugId, treatment.doseMilliUnits);
        }
        const [log] = await tx
          .insert(medicationLogs)
          .values({
            rabbitId: task.rabbitId,
            treatmentId: treatment.id,
            drugId: treatment.drugId,
            givenAt: input.completedAt,
            amountMilliUnits: treatment.doseMilliUnits,
            stockDeductedMilliUnits: deducted,
            notes: input.notes,
          })
          .returning();
        medicationLogId = log.id;
      }
    }
    const [row] = await tx
      .insert(taskCompletions)
      .values({
        taskId: task.id,
        completedAt: input.completedAt,
        completedBy: req.user!.id,
        medicationLogId,
        notes: input.notes,
      })
      .returning();
    return row;
  });
  res.status(201).json({
    completion: taskCompletionToDto(completion, task.rabbitId),
    task: taskToDto(task, completion.completedAt),
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
    await db.transaction(async (tx) => {
      if (completion.medicationLogId !== null) {
        const logRows = await tx
          .select()
          .from(medicationLogs)
          .where(eq(medicationLogs.id, completion.medicationLogId))
          .limit(1);
        const log = logRows[0];
        if (log) {
          if (log.drugId !== null && log.stockDeductedMilliUnits > 0) {
            await restoreDrugStock(tx, log.drugId, log.stockDeductedMilliUnits);
          }
          await tx.delete(medicationLogs).where(eq(medicationLogs.id, log.id));
        }
      }
      await tx.delete(taskCompletions).where(eq(taskCompletions.id, completion.id));
    });
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

async function requireTreatment(rabbitId: number, treatmentId: number | null): Promise<void> {
  if (treatmentId === null) return;
  const rows = await db.select().from(treatments).where(eq(treatments.id, treatmentId)).limit(1);
  if (!rows[0] || rows[0].rabbitId !== rabbitId) {
    throw new HttpError(400, "Unknown treatment for this bunny");
  }
}
