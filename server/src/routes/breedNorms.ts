import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { breedNormToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { breedNorms } from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { addMissingDefaultBreedNorms } from "../lib/breedNormSeed.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { breedNormCreateSchema, breedNormUpdateSchema } from "../lib/validation.ts";

export const breedNormsRouter = Router();

breedNormsRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db.select().from(breedNorms).orderBy(asc(breedNorms.breed));
  res.json({ norms: rows.map(breedNormToDto) });
});

breedNormsRouter.post("/defaults", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ added: await addMissingDefaultBreedNorms() });
});

breedNormsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(breedNormCreateSchema, req.body);
  if (input.minGrams > input.maxGrams) throw new HttpError(400, "Minimum must be below maximum");
  const [row] = await db
    .insert(breedNorms)
    .values({ breed: input.breed, minGrams: input.minGrams, maxGrams: input.maxGrams })
    .returning();
  res.status(201).json({ norm: breedNormToDto(row) });
});

breedNormsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findNorm(id);
  const input = parseInput(breedNormUpdateSchema, req.body);
  const minGrams = input.minGrams ?? existing.minGrams;
  const maxGrams = input.maxGrams ?? existing.maxGrams;
  if (minGrams > maxGrams) throw new HttpError(400, "Minimum must be below maximum");
  const [row] = await db
    .update(breedNorms)
    .set({
      breed: input.breed ?? existing.breed,
      minGrams,
      maxGrams,
      updatedAt: new Date(),
    })
    .where(eq(breedNorms.id, id))
    .returning();
  res.json({ norm: breedNormToDto(row) });
});

breedNormsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findNorm(id);
  await db.delete(breedNorms).where(eq(breedNorms.id, id));
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Norm not found");
  return id;
}

async function findNorm(id: number) {
  const rows = await db.select().from(breedNorms).where(eq(breedNorms.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Norm not found");
  return rows[0];
}
