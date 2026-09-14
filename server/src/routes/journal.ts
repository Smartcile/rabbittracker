import { asc, desc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import { journalEntryToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { journalEntries, journalPhotos } from "../db/schema.ts";
import type { JournalEntryRow, JournalPhotoRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  journalEntryCreateSchema,
  journalEntryUpdateSchema,
  journalPhotoUpdateSchema,
} from "../lib/validation.ts";
import { deletePhotoDir, savePhoto } from "../services/photos.ts";
import { photoUpload } from "./photos.ts";

export const journalRouter = Router();

export async function listJournalForRabbit(
  rabbitId: number,
): Promise<{ entry: JournalEntryRow; photos: JournalPhotoRow[] }[]> {
  const entries = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.rabbitId, rabbitId))
    .orderBy(desc(journalEntries.createdAt), desc(journalEntries.id));
  if (entries.length === 0) return [];
  const photos = await db
    .select()
    .from(journalPhotos)
    .where(inArray(journalPhotos.entryId, entries.map((entry) => entry.id)))
    .orderBy(asc(journalPhotos.sortOrder), asc(journalPhotos.id));
  return entries.map((entry) => ({
    entry,
    photos: photos.filter((photo) => photo.entryId === entry.id),
  }));
}

journalRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(journalEntryCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [row] = await db
    .insert(journalEntries)
    .values({ rabbitId: input.rabbitId, note: input.note })
    .returning();
  res.status(201).json({ entry: journalEntryToDto(row, []) });
});

journalRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const entry = await findEntry(id);
  await findVisibleRabbit(req.user!, entry.rabbitId);
  const input = parseInput(journalEntryUpdateSchema, req.body);
  const [row] = await db
    .update(journalEntries)
    .set({ note: input.note, updatedAt: new Date() })
    .where(eq(journalEntries.id, id))
    .returning();
  const photos = await db
    .select()
    .from(journalPhotos)
    .where(eq(journalPhotos.entryId, id))
    .orderBy(asc(journalPhotos.sortOrder), asc(journalPhotos.id));
  res.json({ entry: journalEntryToDto(row, photos) });
});

journalRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const entry = await findEntry(id);
  await findVisibleRabbit(req.user!, entry.rabbitId);
  const photos = await db
    .select({ id: journalPhotos.id })
    .from(journalPhotos)
    .where(eq(journalPhotos.entryId, id));
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
  for (const photo of photos) {
    await deletePhotoDir("journal", photo.id);
  }
  res.json({ ok: true });
});

journalRouter.post(
  "/:id/photos",
  requireAuth,
  requirePermission("canRecordHealth"),
  photoUpload.single("photo"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    const entry = await findEntry(id);
    await findVisibleRabbit(req.user!, entry.rabbitId);
    if (!req.file) throw new HttpError(400, "No photo uploaded");
    const caption =
      typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 200) : "";
    const [{ value: highest }] = await db
      .select({ value: max(journalPhotos.sortOrder) })
      .from(journalPhotos)
      .where(eq(journalPhotos.entryId, id));
    const [row] = await db
      .insert(journalPhotos)
      .values({ entryId: id, caption, sortOrder: (highest ?? -1) + 1 })
      .returning();
    try {
      await savePhoto("journal", row.id, req.file);
    } catch (err) {
      await db.delete(journalPhotos).where(eq(journalPhotos.id, row.id));
      throw err;
    }
    res.status(201).json({ photo: { id: row.id, caption: row.caption } });
  },
);

journalRouter.patch(
  "/photos/:id",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    const photo = await findPhoto(id);
    const entry = await findEntry(photo.entryId);
    await findVisibleRabbit(req.user!, entry.rabbitId);
    const input = parseInput(journalPhotoUpdateSchema, req.body);
    const [row] = await db
      .update(journalPhotos)
      .set({ caption: input.caption })
      .where(eq(journalPhotos.id, id))
      .returning();
    res.json({ photo: { id: row.id, caption: row.caption } });
  },
);

journalRouter.delete(
  "/photos/:id",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    const photo = await findPhoto(id);
    const entry = await findEntry(photo.entryId);
    await findVisibleRabbit(req.user!, entry.rabbitId);
    await db.delete(journalPhotos).where(eq(journalPhotos.id, id));
    await deletePhotoDir("journal", id);
    res.json({ ok: true });
  },
);

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Journal entry not found");
  return id;
}

async function findEntry(id: number): Promise<JournalEntryRow> {
  const rows = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Journal entry not found");
  return rows[0];
}

async function findPhoto(id: number): Promise<JournalPhotoRow> {
  const rows = await db.select().from(journalPhotos).where(eq(journalPhotos.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Journal photo not found");
  return rows[0];
}
