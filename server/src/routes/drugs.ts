import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import type { DrugDto } from "../../../shared/types.ts";
import { drugBatchToDto, drugToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { drugBatches, drugs } from "../db/schema.ts";
import type { DrugBatchRow, DrugRow } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  drugBatchCreateSchema,
  drugBatchUpdateSchema,
  drugCreateSchema,
  drugUpdateSchema,
} from "../lib/validation.ts";

export const drugsRouter = Router();

drugsRouter.get("/", requireAuth, async (_req, res) => {
  res.json({ drugs: await listDrugs() });
});

drugsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(drugCreateSchema, req.body);
  const [row] = await db
    .insert(drugs)
    .values({
      name: input.name,
      activeIngredient: input.activeIngredient,
      form: input.form,
      unit: input.unit,
      concentrationMicrogramsPerUnit: input.concentrationMicrogramsPerUnit ?? null,
      doseMicrogramsPerKg: input.doseMicrogramsPerKg ?? null,
      dosesPerDay: input.dosesPerDay,
      route: input.route,
      frequency: input.frequency,
      durationDays: input.durationDays ?? null,
      howToUse: input.howToUse,
      warnings: input.warnings,
      reorderLevelMilliUnits: input.reorderLevelMilliUnits,
    })
    .returning();
  res.status(201).json({ drug: drugToDto(row, []) });
});

drugsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Drug not found");
  await findDrug(id);
  const input = parseInput(drugUpdateSchema, req.body);
  const [row] = await db
    .update(drugs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(drugs.id, id))
    .returning();
  res.json({ drug: drugToDto(row, await listBatches(id)) });
});

drugsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Drug not found");
  await findDrug(id);
  await db.delete(drugs).where(eq(drugs.id, id));
  res.json({ ok: true });
});

drugsRouter.post("/:id/batches", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const drugId = parseId(String(req.params.id), "Drug not found");
  await findDrug(drugId);
  const input = parseInput(drugBatchCreateSchema, req.body);
  const [row] = await db
    .insert(drugBatches)
    .values({
      drugId,
      quantityMilliUnits: input.quantityMilliUnits,
      expiryDate: input.expiryDate ?? null,
      batch: input.batch,
      supplier: input.supplier,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ batch: drugBatchToDto(row) });
});

drugsRouter.patch("/batches/:batchId", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const batchId = parseId(String(req.params.batchId), "Batch not found");
  await findBatch(batchId);
  const input = parseInput(drugBatchUpdateSchema, req.body);
  const [row] = await db
    .update(drugBatches)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(drugBatches.id, batchId))
    .returning();
  res.json({ batch: drugBatchToDto(row) });
});

drugsRouter.delete("/batches/:batchId", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const batchId = parseId(String(req.params.batchId), "Batch not found");
  await findBatch(batchId);
  await db.delete(drugBatches).where(eq(drugBatches.id, batchId));
  res.json({ ok: true });
});

async function listDrugs(): Promise<DrugDto[]> {
  const [drugRows, batchRows] = await Promise.all([
    db.select().from(drugs).orderBy(asc(drugs.name)),
    db.select().from(drugBatches).orderBy(asc(drugBatches.expiryDate), asc(drugBatches.id)),
  ]);
  const grouped = new Map<number, DrugBatchRow[]>();
  for (const batch of batchRows) {
    const list = grouped.get(batch.drugId) ?? [];
    list.push(batch);
    grouped.set(batch.drugId, list);
  }
  return drugRows.map((row) => drugToDto(row, grouped.get(row.id) ?? []));
}

async function listBatches(drugId: number): Promise<DrugBatchRow[]> {
  return db
    .select()
    .from(drugBatches)
    .where(eq(drugBatches.drugId, drugId))
    .orderBy(asc(drugBatches.expiryDate), asc(drugBatches.id));
}

function parseId(value: string, message: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, message);
  return id;
}

async function findDrug(id: number): Promise<DrugRow> {
  const rows = await db.select().from(drugs).where(eq(drugs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Drug not found");
  return rows[0];
}

async function findBatch(id: number): Promise<DrugBatchRow> {
  const rows = await db.select().from(drugBatches).where(eq(drugBatches.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Batch not found");
  return rows[0];
}
