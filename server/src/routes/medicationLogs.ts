import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { Router } from "express";
import type { TreatmentSlot } from "../../../shared/types.ts";
import { medicationLogToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { medicationLogs, treatments } from "../db/schema.ts";
import type { MedicationLogRow, TreatmentRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { medicationLogCreateSchema, medicationLogUpdateSchema } from "../lib/validation.ts";
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
  const from = parseQueryDate(req.query.from);
  if (from) conditions.push(gte(medicationLogs.givenAt, from));
  const to = parseQueryDate(req.query.to);
  if (to) conditions.push(lte(medicationLogs.givenAt, to));
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
  let slot: TreatmentSlot | null = input.slot ?? null;
  if (input.treatmentId != null) {
    const treatment = await findTreatment(input.treatmentId, input.rabbitId);
    if (drugId === null) drugId = treatment.drugId;
    if (amountMilliUnits === null) amountMilliUnits = treatment.doseMilliUnits;
    slot = resolveSlot(treatment, slot);
  } else if (slot !== null) {
    throw new HttpError(400, "A time of day needs a linked treatment");
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
        slot,
        amountMilliUnits,
        stockDeductedMilliUnits: deducted,
        notes: input.notes,
      })
      .returning();
  });
  res.status(201).json({ log: medicationLogToDto(row) });
});

medicationLogsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findLog(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const input = parseInput(medicationLogUpdateSchema, req.body);

  const treatmentChanged =
    input.treatmentId !== undefined && input.treatmentId !== existing.treatmentId;
  const treatmentId = input.treatmentId !== undefined ? input.treatmentId : existing.treatmentId;
  const treatment = treatmentId !== null ? await findTreatment(treatmentId, existing.rabbitId) : null;
  const drugId =
    input.drugId !== undefined
      ? input.drugId
      : treatmentChanged
        ? (treatment?.drugId ?? null)
        : existing.drugId;
  const amountMilliUnits =
    input.amountMilliUnits !== undefined
      ? input.amountMilliUnits
      : treatmentChanged
        ? (treatment?.doseMilliUnits ?? null)
        : existing.amountMilliUnits;
  const slot = input.slot !== undefined ? input.slot : treatmentChanged ? null : existing.slot;
  if (slot !== null) {
    if (treatment === null) throw new HttpError(400, "A time of day needs a linked treatment");
    if (!treatment.slots.includes(slot)) {
      throw new HttpError(400, "That time of day is not part of this treatment");
    }
  }

  const [row] = await db.transaction(async (tx) => {
    if (existing.drugId !== null && existing.stockDeductedMilliUnits > 0) {
      await restoreDrugStock(tx, existing.drugId, existing.stockDeductedMilliUnits);
    }
    let deducted = 0;
    if (drugId !== null && amountMilliUnits !== null && amountMilliUnits > 0) {
      deducted = await deductDrugStock(tx, drugId, amountMilliUnits);
    }
    return tx
      .update(medicationLogs)
      .set({
        treatmentId,
        drugId,
        givenAt: input.givenAt ?? existing.givenAt,
        slot,
        amountMilliUnits,
        stockDeductedMilliUnits: deducted,
        notes: input.notes ?? existing.notes,
      })
      .where(eq(medicationLogs.id, id))
      .returning();
  });
  res.json({ log: medicationLogToDto(row) });
});

medicationLogsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
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

function resolveSlot(treatment: TreatmentRow, slot: TreatmentSlot | null): TreatmentSlot | null {
  if (slot === null) {
    return treatment.slots.length === 1 ? (treatment.slots[0] as TreatmentSlot) : null;
  }
  if (!treatment.slots.includes(slot)) {
    throw new HttpError(400, "That time of day is not part of this treatment");
  }
  return slot;
}

async function findTreatment(id: number, rabbitId: number): Promise<TreatmentRow> {
  const rows = await db.select().from(treatments).where(eq(treatments.id, id)).limit(1);
  const treatment = rows[0];
  if (!treatment || treatment.rabbitId !== rabbitId) {
    throw new HttpError(400, "Unknown treatment for this bunny");
  }
  return treatment;
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Medication log not found");
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function findLog(id: number): Promise<MedicationLogRow> {
  const rows = await db.select().from(medicationLogs).where(eq(medicationLogs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Medication log not found");
  return rows[0];
}
