import { eq, max } from "drizzle-orm";
import { Router } from "express";
import { faqEntryToDto, groupFaqEntries } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { faqEntries } from "../db/schema.ts";
import { requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { faqCreateSchema, faqReorderSchema, faqUpdateSchema } from "../lib/validation.ts";

export const faqRouter = Router();

faqRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await db.select().from(faqEntries);
  res.json({ groups: groupFaqEntries(rows) });
});

faqRouter.post("/", requireAuth, requirePermission("canEditFaq"), async (req, res) => {
  const input = parseInput(faqCreateSchema, req.body);
  const [{ value: highest }] = await db
    .select({ value: max(faqEntries.sortOrder) })
    .from(faqEntries)
    .where(eq(faqEntries.category, input.category));
  const [row] = await db
    .insert(faqEntries)
    .values({ ...input, sortOrder: (highest ?? -1) + 1 })
    .returning();
  res.status(201).json({ entry: faqEntryToDto(row) });
});

faqRouter.put("/reorder", requireAuth, requirePermission("canEditFaq"), async (req, res) => {
  const input = parseInput(faqReorderSchema, req.body);
  for (const [index, id] of input.ids.entries()) {
    await db
      .update(faqEntries)
      .set({ sortOrder: index, updatedAt: new Date() })
      .where(eq(faqEntries.id, id));
  }
  const rows = await db.select().from(faqEntries);
  res.json({ groups: groupFaqEntries(rows) });
});

faqRouter.patch("/:id", requireAuth, requirePermission("canEditFaq"), async (req, res) => {
  const id = parseId(String(req.params.id));
  await findEntry(id);
  const input = parseInput(faqUpdateSchema, req.body);
  const [row] = await db
    .update(faqEntries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(faqEntries.id, id))
    .returning();
  res.json({ entry: faqEntryToDto(row) });
});

faqRouter.delete("/:id", requireAuth, requirePermission("canEditFaq"), async (req, res) => {
  const id = parseId(String(req.params.id));
  await findEntry(id);
  await db.delete(faqEntries).where(eq(faqEntries.id, id));
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "FAQ entry not found");
  return id;
}

async function findEntry(id: number) {
  const rows = await db.select().from(faqEntries).where(eq(faqEntries.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "FAQ entry not found");
  return rows[0];
}
