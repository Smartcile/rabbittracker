import { asc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { checklistToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { checklistItems, checklists, checklistSections, checkLogTypes } from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import {
  findChecklist,
  findSection,
  listChecklistItems,
  listChecklists,
  uniqueChecklistKey,
} from "../lib/checklistStore.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  checklistCreateSchema,
  checklistItemCreateSchema,
  checklistItemReorderSchema,
  checklistUpdateSchema,
} from "../lib/validation.ts";

export const checklistsRouter = Router();

checklistsRouter.get("/", requireAuth, async (_req, res) => {
  const rows = await listChecklists();
  const counts =
    rows.length > 0
      ? await db
          .select({ checklistId: checklistItems.checklistId })
          .from(checklistItems)
          .where(inArray(checklistItems.checklistId, rows.map((row) => row.id)))
      : [];
  res.json({
    checklists: rows.map((row) =>
      checklistToDto(row, counts.filter((item) => item.checklistId === row.id).length),
    ),
  });
});

checklistsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(checklistCreateSchema, req.body);
  const key = await uniqueChecklistKey(input.label);
  const [{ value: highest }] = await db
    .select({ value: max(checklists.sortOrder) })
    .from(checklists);
  const [row] = await db
    .insert(checklists)
    .values({ key, label: input.label, sortOrder: (highest ?? -1) + 1 })
    .returning();
  res.status(201).json({ checklist: checklistToDto(row, 0) });
});

checklistsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  const input = parseInput(checklistUpdateSchema, req.body);
  const [row] = await db
    .update(checklists)
    .set({ label: input.label, updatedAt: new Date() })
    .where(eq(checklists.id, checklist.id))
    .returning();
  const items = await listChecklistItems(row.id);
  res.json({ checklist: checklistToDto(row, items.length) });
});

checklistsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  if (checklist.isDaily) throw new HttpError(400, "The Daily checks list cannot be deleted");
  await db.delete(checklists).where(eq(checklists.id, checklist.id));
  res.json({ ok: true });
});

checklistsRouter.get("/:id/items", requireAuth, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  res.json({ items: await itemsFor(checklist.id) });
});

checklistsRouter.post("/:id/items", requireAuth, requireAdmin, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  const input = parseInput(checklistItemCreateSchema, req.body);
  if (input.sectionId !== undefined) await findSection(input.sectionId);
  if (input.typeId !== undefined) await findType(input.typeId);
  const existing = await listChecklistItems(checklist.id);
  if (
    existing.some(
      (item) =>
        (input.sectionId !== undefined && item.sectionId === input.sectionId) ||
        (input.typeId !== undefined && item.typeId === input.typeId),
    )
  ) {
    throw new HttpError(409, "Already in this checklist");
  }
  const maxOrder = existing.reduce((value, item) => Math.max(value, item.sortOrder), -1);
  await db.insert(checklistItems).values({
    checklistId: checklist.id,
    sectionId: input.sectionId ?? null,
    typeId: input.typeId ?? null,
    sortOrder: maxOrder + 1,
  });
  res.status(201).json({ items: await itemsFor(checklist.id) });
});

checklistsRouter.put("/:id/reorder", requireAuth, requireAdmin, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  const input = parseInput(checklistItemReorderSchema, req.body);
  for (const [index, id] of input.ids.entries()) {
    await db
      .update(checklistItems)
      .set({ sortOrder: index })
      .where(eq(checklistItems.id, id));
  }
  res.json({ items: await itemsFor(checklist.id) });
});

checklistsRouter.delete("/:id/items/:itemId", requireAuth, requireAdmin, async (req, res) => {
  const checklist = await findChecklist(parseId(String(req.params.id)));
  const itemId = parseId(String(req.params.itemId));
  const rows = await db
    .delete(checklistItems)
    .where(eq(checklistItems.id, itemId))
    .returning({ id: checklistItems.id, checklistId: checklistItems.checklistId });
  if (!rows[0] || rows[0].checklistId !== checklist.id) {
    throw new HttpError(404, "Checklist item not found");
  }
  res.json({ items: await itemsFor(checklist.id) });
});

async function itemsFor(checklistId: number) {
  const items = await listChecklistItems(checklistId);
  const sectionIds = items
    .filter((item) => item.sectionId !== null)
    .map((item) => item.sectionId as number);
  const typeIds = items.filter((item) => item.typeId !== null).map((item) => item.typeId as number);
  const [sections, types] = await Promise.all([
    sectionIds.length > 0
      ? db
          .select({ id: checklistSections.id, label: checklistSections.label })
          .from(checklistSections)
          .where(inArray(checklistSections.id, sectionIds))
      : Promise.resolve([]),
    typeIds.length > 0
      ? db
          .select({ id: checkLogTypes.id, label: checkLogTypes.label })
          .from(checkLogTypes)
          .where(inArray(checkLogTypes.id, typeIds))
      : Promise.resolve([]),
  ]);
  const sectionById = new Map(sections.map((section) => [section.id, section.label]));
  const typeById = new Map(types.map((type) => [type.id, type.label]));
  return items.map((item) => ({
    id: item.id,
    kind: item.sectionId !== null ? ("section" as const) : ("type" as const),
    sectionId: item.sectionId,
    typeId: item.typeId,
    label:
      item.sectionId !== null
        ? (sectionById.get(item.sectionId) ?? "Section")
        : (typeById.get(item.typeId as number) ?? "Check"),
    sortOrder: item.sortOrder,
  }));
}

async function findType(id: number) {
  const rows = await db.select().from(checkLogTypes).where(eq(checkLogTypes.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Check type not found");
  return rows[0];
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found");
  return id;
}
