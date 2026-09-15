import { asc, eq, max } from "drizzle-orm";
import { Router } from "express";
import { lookupToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { lookups } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { findLookup, uniqueLookupValue } from "../lib/lookupStore.ts";
import { addMissingDefaultLookups } from "../lib/lookupSeed.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { lookupCreateSchema, lookupUpdateSchema } from "../lib/validation.ts";

export const lookupsRouter = Router();

lookupsRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(lookups)
    .orderBy(asc(lookups.kind), asc(lookups.sortOrder), asc(lookups.id));
  res.json({ lookups: rows.map(lookupToDto) });
});

lookupsRouter.post("/defaults", requireAuth, requirePermission("canRecordHealth"), async (_req, res) => {
  res.json({ added: await addMissingDefaultLookups() });
});

lookupsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(lookupCreateSchema, req.body);
  const value = await uniqueLookupValue(input.kind, input.label);
  const [{ value: highest }] = await db
    .select({ value: max(lookups.sortOrder) })
    .from(lookups)
    .where(eq(lookups.kind, input.kind));
  const [row] = await db
    .insert(lookups)
    .values({
      kind: input.kind,
      value,
      label: input.label,
      defaultInt: input.defaultInt ?? null,
      defaultCents: input.defaultCents ?? null,
      sortOrder: (highest ?? -1) + 1,
    })
    .returning();
  res.status(201).json({ lookup: lookupToDto(row) });
});

lookupsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  await findLookup(id);
  const input = parseInput(lookupUpdateSchema, req.body);
  const [row] = await db
    .update(lookups)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.defaultInt !== undefined ? { defaultInt: input.defaultInt } : {}),
      ...(input.defaultCents !== undefined ? { defaultCents: input.defaultCents } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lookups.id, id))
    .returning();
  res.json({ lookup: lookupToDto(row) });
});

lookupsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findLookup(id);
  await db.delete(lookups).where(eq(lookups.id, id));
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "List item not found");
  return id;
}
