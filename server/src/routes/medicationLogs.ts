import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { medicationLogToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { medicationLogs, treatments } from "../db/schema.ts";
import type { MedicationLogRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { medicationLogCreateSchema } from "../lib/validation.ts";
import { deductDrugStock, restoreDrugStock } from "../services/drugStock.ts";

export const medicationLogsRouter = Router();

medicationLogsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(medicationLogs.rabbitId, visibleRabbitIds(req.user!)));
  }
  const rabbitId = Number(req.query.rabbitId);
  if (Number.isInteger(rabbitId) && rabbitId > 0) {
    conditions.push(eq(medicationLogs.rabbitId, rabbitId));
  }
  const rows = await db
    .select()
    .from(medicationLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(medicationLogs.givenAt))
    .limit(500);
  res.json({ logs: rows.map(medicationLogToDto) });
});

medicationLogsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(medicationLogCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);

  let drugId = input.drugId ?? null;
  let amountMilliUnits = input.amountMilliUnits ?? null;
  if (input.treatmentId != null) {
    const treatmentRows = await db
      .select()
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .limit(1);
    const treatment = treatmentRows[0];
    if (!treatment || treatment.rabbitId !== input.rabbitId) {
      throw new HttpError(400, "Unknown treatment for this bunny");
    }
    if (drugId === null) drugId = treatment.drugId;
    if (amountMilliUnits === null) amountMilliUnits = treatment.doseMilliUnits;
  }

  const [row] = await db.transaction(async (tx) => {
    let deducted = 0;
    if (drugId !== null && amountMilliUnits !== null && amountMilliUnits > 0) {
      deducted = await deductDrugStock(tx, drugId, amountMilliUnits);
    }
    return tx
      .insert(medicationLogs)
      .values({
        rabbitId: input.rabbitId,
        treatmentId: input.treatmentId ?? null,
        drugId,
        givenAt: input.givenAt,
        amountMilliUnits,
        stockDeductedMilliUnits: deducted,
        notes: input.notes,
      })
      .returning();
  });
  res.status(201).json({ log: medicationLogToDto(row) });
});

medicationLogsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Medication log not found");
  const existing = await findLog(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.transaction(async (tx) => {
    if (existing.drugId !== null && existing.stockDeductedMilliUnits > 0) {
      await restoreDrugStock(tx, existing.drugId, existing.stockDeductedMilliUnits);
    }
    await tx.delete(medicationLogs).where(eq(medicationLogs.id, id));
  });
  res.json({ ok: true });
});

async function findLog(id: number): Promise<MedicationLogRow> {
  const rows = await db.select().from(medicationLogs).where(eq(medicationLogs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Medication log not found");
  return rows[0];
}
