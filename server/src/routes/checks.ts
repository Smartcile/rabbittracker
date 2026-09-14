import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { Router } from "express";
import { healthCheckToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { healthChecks } from "../db/schema.ts";
import type { HealthCheckRow } from "../db/schema.ts";
import { validateChecklistAnswers } from "../../../shared/checklist.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { listChecklistSections } from "../lib/checklistStore.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { checkCreateSchema, checkUpdateSchema, hasCheckContent } from "../lib/validation.ts";
import { deletePhotoDir, savePhoto } from "../services/photos.ts";
import { photoUpload } from "./photos.ts";

export const checksRouter = Router();

export function listChecksForRabbit(rabbitId: number): Promise<HealthCheckRow[]> {
  return db
    .select()
    .from(healthChecks)
    .where(eq(healthChecks.rabbitId, rabbitId))
    .orderBy(desc(healthChecks.checkedAt));
}

checksRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(healthChecks.rabbitId, visibleRabbitIds(req.user!)));
  }
  if (req.query.rabbitId !== undefined) {
    const rabbitId = Number(req.query.rabbitId);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(400, "Invalid rabbitId");
    conditions.push(eq(healthChecks.rabbitId, rabbitId));
  }
  const from = parseQueryDate(req.query.from);
  if (from) conditions.push(gte(healthChecks.checkedAt, from));
  const to = parseQueryDate(req.query.to);
  if (to) conditions.push(lte(healthChecks.checkedAt, to));
  const rows = await db
    .select()
    .from(healthChecks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(healthChecks.checkedAt));
  res.json({ checks: rows.map(healthCheckToDto) });
});

checksRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(checkCreateSchema, req.body);
  if (input.checklist) {
    const problem = validateChecklistAnswers(input.checklist, await listChecklistSections());
    if (problem) throw new HttpError(400, problem);
  }
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [row] = await db
    .insert(healthChecks)
    .values({
      rabbitId: input.rabbitId,
      checkedAt: input.checkedAt,
      weightGrams: input.weightGrams ?? null,
      appetite: input.appetite ?? null,
      droppings: input.droppings ?? null,
      energy: input.energy ?? null,
      bodyCondition: input.bodyCondition ?? null,
      temperatureTenthsC: input.temperatureTenthsC ?? null,
      painScore: input.painScore ?? null,
      checklist: input.checklist ?? null,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ check: healthCheckToDto(row) });
});

checksRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseCheckId(String(req.params.id));
  const existing = await findCheck(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const input = parseInput(checkUpdateSchema, req.body);
  if (input.checklist !== undefined) {
    const problem = validateChecklistAnswers(input.checklist, await listChecklistSections());
    if (problem) throw new HttpError(400, problem);
  }
  const merged = {
    weightGrams: input.weightGrams !== undefined ? input.weightGrams : existing.weightGrams,
    appetite: input.appetite !== undefined ? input.appetite : existing.appetite,
    droppings: input.droppings !== undefined ? input.droppings : existing.droppings,
    energy: input.energy !== undefined ? input.energy : existing.energy,
    bodyCondition: input.bodyCondition !== undefined ? input.bodyCondition : existing.bodyCondition,
    temperatureTenthsC:
      input.temperatureTenthsC !== undefined ? input.temperatureTenthsC : existing.temperatureTenthsC,
    painScore: input.painScore !== undefined ? input.painScore : existing.painScore,
    notes: input.notes !== undefined ? input.notes : existing.notes,
  };
  if (!hasCheckContent(merged)) throw new HttpError(400, "Add a weight, a status or notes");
  const [row] = await db
    .update(healthChecks)
    .set({
      checkedAt: input.checkedAt ?? existing.checkedAt,
      ...merged,
      checklist: input.checklist !== undefined ? input.checklist : existing.checklist,
    })
    .where(eq(healthChecks.id, id))
    .returning();
  res.json({ check: healthCheckToDto(row) });
});

checksRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseCheckId(String(req.params.id));
  const existing = await findCheck(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.delete(healthChecks).where(eq(healthChecks.id, id));
  await deletePhotoDir("check", id);
  res.json({ ok: true });
});

checksRouter.post(
  "/:id/photo",
  requireAuth,
  requirePermission("canRecordHealth"),
  photoUpload.single("photo"),
  async (req, res) => {
    const id = parseCheckId(String(req.params.id));
    const existing = await findCheck(id);
    await findVisibleRabbit(req.user!, existing.rabbitId);
    if (!req.file) throw new HttpError(400, "No photo uploaded");
    await savePhoto("check", id, req.file);
    const [row] = await db
      .update(healthChecks)
      .set({ hasPhoto: true })
      .where(eq(healthChecks.id, id))
      .returning();
    res.json({ check: healthCheckToDto(row) });
  },
);

checksRouter.delete("/:id/photo", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseCheckId(String(req.params.id));
  const existing = await findCheck(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await deletePhotoDir("check", id);
  const [row] = await db
    .update(healthChecks)
    .set({ hasPhoto: false })
    .where(eq(healthChecks.id, id))
    .returning();
  res.json({ check: healthCheckToDto(row) });
});

function parseCheckId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Check not found");
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
  return date;
}

async function findCheck(id: number): Promise<HealthCheckRow> {
  const rows = await db.select().from(healthChecks).where(eq(healthChecks.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Check not found");
  return rows[0];
}
