import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { vetToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { clinics, vets } from "../db/schema.ts";
import type { VetRow } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { vetCreateSchema, vetUpdateSchema } from "../lib/validation.ts";

export const vetsRouter = Router();

vetsRouter.get("/", requireAuth, async (_req, res) => {
  const [rows, names] = await Promise.all([
    db.select().from(vets).orderBy(asc(vets.name), asc(vets.id)),
    clinicNames(),
  ]);
  res.json({ vets: rows.map((row) => toDto(row, names)) });
});

vetsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(vetCreateSchema, req.body);
  await requireClinic(input.clinicId);
  const [row] = await db.insert(vets).values(input).returning();
  res.status(201).json({ vet: toDto(row, await clinicNames()) });
});

vetsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const input = parseInput(vetUpdateSchema, req.body);
  await requireClinic(input.clinicId);
  const [row] = await db
    .update(vets)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(vets.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Vet not found");
  res.json({ vet: toDto(row, await clinicNames()) });
});

vetsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const rows = await db.delete(vets).where(eq(vets.id, id)).returning({ id: vets.id });
  if (!rows[0]) throw new HttpError(404, "Vet not found");
  res.json({ ok: true });
});

async function clinicNames(): Promise<Map<number, string>> {
  const rows = await db.select({ id: clinics.id, name: clinics.name }).from(clinics);
  return new Map(rows.map((row) => [row.id, row.name]));
}

function toDto(row: VetRow, names: Map<number, string>) {
  return vetToDto(row, row.clinicId ? names.get(row.clinicId) ?? "" : "");
}

async function requireClinic(id: number | null | undefined): Promise<void> {
  if (id == null) return;
  const rows = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(400, "Unknown clinic");
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Vet not found");
  return id;
}
