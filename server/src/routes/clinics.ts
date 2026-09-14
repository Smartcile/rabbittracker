import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { clinicToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { clinics } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { clinicCreateSchema, clinicUpdateSchema } from "../lib/validation.ts";

export const clinicsRouter = Router();

clinicsRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db.select().from(clinics).orderBy(asc(clinics.name), asc(clinics.id));
  res.json({ clinics: rows.map(clinicToDto) });
});

clinicsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(clinicCreateSchema, req.body);
  const [row] = await db.insert(clinics).values(input).returning();
  res.status(201).json({ clinic: clinicToDto(row) });
});

clinicsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const input = parseInput(clinicUpdateSchema, req.body);
  const [row] = await db
    .update(clinics)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(clinics.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Clinic not found");
  res.json({ clinic: clinicToDto(row) });
});

clinicsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const rows = await db.delete(clinics).where(eq(clinics.id, id)).returning({ id: clinics.id });
  if (!rows[0]) throw new HttpError(404, "Clinic not found");
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Clinic not found");
  return id;
}
