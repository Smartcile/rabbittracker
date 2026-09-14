import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { treatmentToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { drugs, treatments } from "../db/schema.ts";
import type { DrugRow, TreatmentRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { treatmentCreateSchema, treatmentUpdateSchema } from "../lib/validation.ts";

export const treatmentsRouter = Router();

export function listTreatmentsForRabbit(rabbitId: number): Promise<TreatmentRow[]> {
  return db
    .select()
    .from(treatments)
    .where(eq(treatments.rabbitId, rabbitId))
    .orderBy(desc(treatments.startDate));
}

treatmentsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(treatments.rabbitId, visibleRabbitIds(req.user!)));
  }
  if (req.query.rabbitId !== undefined) {
    const rabbitId = Number(req.query.rabbitId);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(400, "Invalid rabbitId");
    conditions.push(eq(treatments.rabbitId, rabbitId));
  }
  const rows = await db
    .select()
    .from(treatments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(treatments.startDate));
  res.json({ treatments: rows.map(treatmentToDto) });
});

treatmentsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(treatmentCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const drug = input.drugId ? await findDrug(input.drugId) : null;
  const [row] = await db
    .insert(treatments)
    .values({
      rabbitId: input.rabbitId,
      medication: input.medication,
      dose: input.dose,
      route: input.route,
      frequency: input.frequency,
      reason: input.reason,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      status: input.status,
      notes: input.notes,
      drugId: drug?.id ?? null,
      doseMilliUnits: drug ? (input.doseMilliUnits ?? null) : null,
    })
    .returning();
  res.status(201).json({ treatment: treatmentToDto(row) });
});

treatmentsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findTreatment(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const input = parseInput(treatmentUpdateSchema, req.body);
  const nextDrugId = input.drugId !== undefined ? input.drugId : existing.drugId;
  const nextDose =
    input.doseMilliUnits !== undefined ? input.doseMilliUnits : existing.doseMilliUnits;
  const drug = nextDrugId ? await findDrug(nextDrugId) : null;
  const [row] = await db
    .update(treatments)
    .set({
      medication: input.medication ?? existing.medication,
      dose: input.dose ?? existing.dose,
      route: input.route ?? existing.route,
      frequency: input.frequency ?? existing.frequency,
      reason: input.reason ?? existing.reason,
      startDate: input.startDate ?? existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      status: input.status ?? existing.status,
      notes: input.notes ?? existing.notes,
      drugId: drug?.id ?? null,
      doseMilliUnits: drug ? nextDose : null,
      updatedAt: new Date(),
    })
    .where(eq(treatments.id, id))
    .returning();
  res.json({ treatment: treatmentToDto(row) });
});

treatmentsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findTreatment(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.delete(treatments).where(eq(treatments.id, id));
  res.json({ ok: true });
});

async function findDrug(id: number): Promise<DrugRow> {
  const rows = await db.select().from(drugs).where(eq(drugs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Drug not found");
  return rows[0];
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Treatment not found");
  return id;
}

async function findTreatment(id: number): Promise<TreatmentRow> {
  const rows = await db.select().from(treatments).where(eq(treatments.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Treatment not found");
  return rows[0];
}
