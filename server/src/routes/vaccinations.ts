import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { vaccinationToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { vaccinations } from "../db/schema.ts";
import type { VaccinationRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { vaccinationCreateSchema, vaccinationUpdateSchema } from "../lib/validation.ts";

export const vaccinationsRouter = Router();

export function listVaccinationsForRabbit(rabbitId: number): Promise<VaccinationRow[]> {
  return db
    .select()
    .from(vaccinations)
    .where(eq(vaccinations.rabbitId, rabbitId))
    .orderBy(desc(vaccinations.givenAt));
}

vaccinationsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(vaccinations.rabbitId, visibleRabbitIds(req.user!)));
  }
  if (req.query.rabbitId !== undefined) {
    const rabbitId = Number(req.query.rabbitId);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(400, "Invalid rabbitId");
    conditions.push(eq(vaccinations.rabbitId, rabbitId));
  }
  const rows = await db
    .select()
    .from(vaccinations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vaccinations.givenAt));
  res.json({ vaccinations: rows.map(vaccinationToDto) });
});

vaccinationsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(vaccinationCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [row] = await db
    .insert(vaccinations)
    .values({
      rabbitId: input.rabbitId,
      vaccine: input.vaccine,
      givenAt: input.givenAt,
      nextDueAt: input.nextDueAt ?? null,
      vet: input.vet,
      batch: input.batch,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ vaccination: vaccinationToDto(row) });
});

vaccinationsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findVaccination(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const input = parseInput(vaccinationUpdateSchema, req.body);
  const [row] = await db
    .update(vaccinations)
    .set({ ...input })
    .where(eq(vaccinations.id, id))
    .returning();
  res.json({ vaccination: vaccinationToDto(row) });
});

vaccinationsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findVaccination(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.delete(vaccinations).where(eq(vaccinations.id, id));
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Vaccination not found");
  return id;
}

async function findVaccination(id: number): Promise<VaccinationRow> {
  const rows = await db.select().from(vaccinations).where(eq(vaccinations.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Vaccination not found");
  return rows[0];
}
