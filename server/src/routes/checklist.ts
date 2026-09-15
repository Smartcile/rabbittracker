import { asc, eq, max } from "drizzle-orm";
import { Router } from "express";
import { checklistSectionToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import {
  checklistItems,
  checklistOptions,
  checklistPhotos,
  checklistSections,
} from "../db/schema.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import {
  findSection,
  getChecklistByKey,
  listAllChecklistSections,
  listChecklistConfig,
  listChecklistTypeKeys,
  uniqueOptionValue,
  uniqueSectionKey,
  WEEKLY_CHECKLIST_KEY,
} from "../lib/checklistStore.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  checklistOptionCreateSchema,
  checklistOptionUpdateSchema,
  checklistPhotoUpdateSchema,
  checklistReorderSchema,
  checklistSectionCreateSchema,
  checklistSectionUpdateSchema,
} from "../lib/validation.ts";
import { deletePhotoDir, savePhoto } from "../services/photos.ts";
import { photoUpload } from "./photos.ts";

export const checklistRouter = Router();

checklistRouter.get("/", requireAuth, async (_req, res) => {
  res.json({ sections: await listChecklistConfig(), typeKeys: await listChecklistTypeKeys() });
});

checklistRouter.get("/sections", requireAuth, async (_req, res) => {
  res.json({ sections: await listAllChecklistSections() });
});

checklistRouter.post("/sections", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(checklistSectionCreateSchema, req.body);
  const key = await uniqueSectionKey(input.label);
  const [{ value: highest }] = await db
    .select({ value: max(checklistSections.sortOrder) })
    .from(checklistSections);
  const [row] = await db
    .insert(checklistSections)
    .values({
      key,
      label: input.label,
      hint: input.hint,
      multiple: input.multiple,
      unit: input.unit,
      hasNumber: input.hasNumber,
      hasText: input.hasText,
      sortOrder: (highest ?? -1) + 1,
    })
    .returning();
  const weekly = await getChecklistByKey(WEEKLY_CHECKLIST_KEY);
  if (weekly) {
    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, weekly.id));
    const maxOrder = items.reduce((value, item) => Math.max(value, item.sortOrder), -1);
    await db
      .insert(checklistItems)
      .values({ checklistId: weekly.id, sectionId: row.id, sortOrder: maxOrder + 1 });
  }
  res.status(201).json({ section: checklistSectionToDto(row, [], []) });
});

checklistRouter.put("/sections/reorder", requireAuth, requireAdmin, async (req, res) => {
  const input = parseInput(checklistReorderSchema, req.body);
  for (const [index, id] of input.ids.entries()) {
    await db
      .update(checklistSections)
      .set({ sortOrder: index, updatedAt: new Date() })
      .where(eq(checklistSections.id, id));
  }
  res.json({ sections: await listChecklistConfig() });
});

checklistRouter.patch("/sections/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findSection(id);
  const input = parseInput(checklistSectionUpdateSchema, req.body);
  const [row] = await db
    .update(checklistSections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(checklistSections.id, id))
    .returning();
  const [options, photos] = await Promise.all([
    db
      .select()
      .from(checklistOptions)
      .where(eq(checklistOptions.sectionId, id))
      .orderBy(asc(checklistOptions.sortOrder), asc(checklistOptions.id)),
    db
      .select()
      .from(checklistPhotos)
      .where(eq(checklistPhotos.sectionId, id))
      .orderBy(asc(checklistPhotos.sortOrder), asc(checklistPhotos.id)),
  ]);
  res.json({ section: checklistSectionToDto(row, options, photos) });
});

checklistRouter.delete("/sections/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findSection(id);
  const photos = await db
    .select({ id: checklistPhotos.id })
    .from(checklistPhotos)
    .where(eq(checklistPhotos.sectionId, id));
  await db.delete(checklistSections).where(eq(checklistSections.id, id));
  for (const photo of photos) {
    await deletePhotoDir("checklist", photo.id);
  }
  res.json({ ok: true });
});

checklistRouter.post("/sections/:id/options", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  await findSection(id);
  const input = parseInput(checklistOptionCreateSchema, req.body);
  const value = await uniqueOptionValue(id, input.label);
  const [{ value: highest }] = await db
    .select({ value: max(checklistOptions.sortOrder) })
    .from(checklistOptions)
    .where(eq(checklistOptions.sectionId, id));
  const [row] = await db
    .insert(checklistOptions)
    .values({ sectionId: id, value, label: input.label, sortOrder: (highest ?? -1) + 1 })
    .returning();
  res.status(201).json({ option: { id: row.id, value: row.value, label: row.label } });
});

checklistRouter.patch("/options/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const input = parseInput(checklistOptionUpdateSchema, req.body);
  const [row] = await db
    .update(checklistOptions)
    .set({ label: input.label })
    .where(eq(checklistOptions.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Checklist option not found");
  res.json({ option: { id: row.id, value: row.value, label: row.label } });
});

checklistRouter.delete("/options/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const rows = await db
    .delete(checklistOptions)
    .where(eq(checklistOptions.id, id))
    .returning({ id: checklistOptions.id });
  if (!rows[0]) throw new HttpError(404, "Checklist option not found");
  res.json({ ok: true });
});

checklistRouter.post(
  "/sections/:id/photos",
  requireAuth,
  requireAdmin,
  photoUpload.single("photo"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    await findSection(id);
    if (!req.file) throw new HttpError(400, "No photo uploaded");
    const caption =
      typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 200) : "";
    const [{ value: highest }] = await db
      .select({ value: max(checklistPhotos.sortOrder) })
      .from(checklistPhotos)
      .where(eq(checklistPhotos.sectionId, id));
    const [row] = await db
      .insert(checklistPhotos)
      .values({ sectionId: id, caption, sortOrder: (highest ?? -1) + 1 })
      .returning();
    try {
      await savePhoto("checklist", row.id, req.file);
    } catch (err) {
      await db.delete(checklistPhotos).where(eq(checklistPhotos.id, row.id));
      throw err;
    }
    res.status(201).json({ photo: { id: row.id, caption: row.caption } });
  },
);

checklistRouter.patch("/photos/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const input = parseInput(checklistPhotoUpdateSchema, req.body);
  const [row] = await db
    .update(checklistPhotos)
    .set({ caption: input.caption })
    .where(eq(checklistPhotos.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Checklist photo not found");
  res.json({ photo: { id: row.id, caption: row.caption } });
});

checklistRouter.delete("/photos/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id));
  const rows = await db
    .delete(checklistPhotos)
    .where(eq(checklistPhotos.id, id))
    .returning({ id: checklistPhotos.id });
  if (!rows[0]) throw new HttpError(404, "Checklist photo not found");
  await deletePhotoDir("checklist", id);
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found");
  return id;
}
