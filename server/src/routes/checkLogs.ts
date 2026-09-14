import { and, asc, desc, eq, gte, inArray, lte, max } from "drizzle-orm";
import { Router } from "express";
import { slugifyLabel } from "../../../shared/checklist.ts";
import { checkLogToDto, checkLogTypeToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { checkLogPhotos, checkLogs, checkLogTypes } from "../db/schema.ts";
import type { CheckLogPhotoRow, CheckLogTypeRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { listCheckLogTypes } from "../lib/checkLogStore.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  checkLogCreateSchema,
  checkLogTypeCreateSchema,
  checkLogTypeUpdateSchema,
  checkLogUpdateSchema,
} from "../lib/validation.ts";
import { deletePhotoDir, savePhoto } from "../services/photos.ts";
import { photoUpload } from "./photos.ts";

export const checkLogsRouter = Router();

checkLogsRouter.get("/types", requireAuth, async (_req, res) => {
  res.json({ types: (await listCheckLogTypes()).map(checkLogTypeToDto) });
});

checkLogsRouter.post("/types", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(checkLogTypeCreateSchema, req.body);
  const key = await uniqueTypeKey(input.label);
  const [{ value: highest }] = await db
    .select({ value: max(checkLogTypes.sortOrder) })
    .from(checkLogTypes);
  const [row] = await db
    .insert(checkLogTypes)
    .values({ ...input, key, sortOrder: (highest ?? -1) + 1 })
    .returning();
  res.status(201).json({ type: checkLogTypeToDto(row) });
});

checkLogsRouter.patch("/types/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Check type not found");
  const input = parseInput(checkLogTypeUpdateSchema, req.body);
  const [row] = await db
    .update(checkLogTypes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(checkLogTypes.id, id))
    .returning();
  if (!row) throw new HttpError(404, "Check type not found");
  res.json({ type: checkLogTypeToDto(row) });
});

checkLogsRouter.delete("/types/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseId(String(req.params.id), "Check type not found");
  const rows = await db
    .delete(checkLogTypes)
    .where(eq(checkLogTypes.id, id))
    .returning({ id: checkLogTypes.id });
  if (!rows[0]) throw new HttpError(404, "Check type not found");
  res.json({ ok: true });
});

checkLogsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(checkLogs.rabbitId, visibleRabbitIds(req.user!)));
  }
  const rabbitId = Number(req.query.rabbitId);
  if (Number.isInteger(rabbitId) && rabbitId > 0) conditions.push(eq(checkLogs.rabbitId, rabbitId));
  const from = parseQueryDate(req.query.from);
  if (from) conditions.push(gte(checkLogs.loggedAt, from));
  const to = parseQueryDate(req.query.to);
  if (to) conditions.push(lte(checkLogs.loggedAt, to));
  const rows = await db
    .select()
    .from(checkLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(checkLogs.loggedAt))
    .limit(500);
  const types = new Map((await listCheckLogTypes()).map((type) => [type.id, type]));
  const photos =
    rows.length > 0
      ? await db
          .select()
          .from(checkLogPhotos)
          .where(inArray(checkLogPhotos.logId, rows.map((row) => row.id)))
          .orderBy(asc(checkLogPhotos.sortOrder), asc(checkLogPhotos.id))
      : [];
  res.json({
    logs: rows.map((row) =>
      checkLogToDto(
        row,
        types.get(row.typeId),
        photos.filter((photo) => photo.logId === row.id),
      ),
    ),
  });
});

checkLogsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(checkLogCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const type = await findType(input.typeId);
  const [row] = await db
    .insert(checkLogs)
    .values({
      rabbitId: input.rabbitId,
      typeId: input.typeId,
      loggedAt: input.loggedAt,
      valueMilli: input.valueMilli ?? null,
      valueLabels: input.valueLabels,
      valueText: input.valueText,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ log: checkLogToDto(row, type) });
});

checkLogsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Check log not found");
  const existing = await findLog(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const input = parseInput(checkLogUpdateSchema, req.body);
  const [row] = await db
    .update(checkLogs)
    .set({
      loggedAt: input.loggedAt ?? existing.loggedAt,
      valueMilli: input.valueMilli !== undefined ? input.valueMilli : existing.valueMilli,
      valueLabels: input.valueLabels !== undefined ? input.valueLabels : existing.valueLabels,
      valueText: input.valueText !== undefined ? input.valueText : existing.valueText,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    })
    .where(eq(checkLogs.id, id))
    .returning();
  const type = await findType(row.typeId);
  const photos = await listPhotosForLog(id);
  res.json({ log: checkLogToDto(row, type, photos) });
});

checkLogsRouter.post(
  "/:id/photos",
  requireAuth,
  requirePermission("canRecordHealth"),
  photoUpload.single("photo"),
  async (req, res) => {
    const id = parseId(String(req.params.id), "Check log not found");
    const log = await findLog(id);
    await findVisibleRabbit(req.user!, log.rabbitId);
    if (!req.file) throw new HttpError(400, "No photo uploaded");
    const caption =
      typeof req.body?.caption === "string" ? req.body.caption.trim().slice(0, 200) : "";
    const [{ value: highest }] = await db
      .select({ value: max(checkLogPhotos.sortOrder) })
      .from(checkLogPhotos)
      .where(eq(checkLogPhotos.logId, id));
    const [row] = await db
      .insert(checkLogPhotos)
      .values({ logId: id, caption, sortOrder: (highest ?? -1) + 1 })
      .returning();
    try {
      await savePhoto("checklog", row.id, req.file);
    } catch (err) {
      await db.delete(checkLogPhotos).where(eq(checkLogPhotos.id, row.id));
      throw err;
    }
    res.status(201).json({ photo: { id: row.id, caption: row.caption, sortOrder: row.sortOrder } });
  },
);

checkLogsRouter.delete(
  "/photos/:id",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const id = parseId(String(req.params.id), "Check log photo not found");
    const photo = await findPhoto(id);
    const log = await findLog(photo.logId);
    await findVisibleRabbit(req.user!, log.rabbitId);
    await db.delete(checkLogPhotos).where(eq(checkLogPhotos.id, id));
    await deletePhotoDir("checklog", id);
    res.json({ ok: true });
  },
);

checkLogsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Check log not found");
  const existing = await findLog(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const photos = await db
    .select({ id: checkLogPhotos.id })
    .from(checkLogPhotos)
    .where(eq(checkLogPhotos.logId, id));
  await db.delete(checkLogs).where(eq(checkLogs.id, id));
  for (const photo of photos) {
    await deletePhotoDir("checklog", photo.id);
  }
  res.json({ ok: true });
});

async function uniqueTypeKey(label: string): Promise<string> {
  const rows = await db.select({ key: checkLogTypes.key }).from(checkLogTypes);
  const taken = new Set(rows.map((row) => row.key));
  const base = slugifyLabel(label);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

async function findType(id: number): Promise<CheckLogTypeRow> {
  const rows = await db.select().from(checkLogTypes).where(eq(checkLogTypes.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(400, "Unknown check type");
  return rows[0];
}

async function findLog(id: number) {
  const rows = await db.select().from(checkLogs).where(eq(checkLogs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Check log not found");
  return rows[0];
}

async function listPhotosForLog(logId: number): Promise<CheckLogPhotoRow[]> {
  return db
    .select()
    .from(checkLogPhotos)
    .where(eq(checkLogPhotos.logId, logId))
    .orderBy(asc(checkLogPhotos.sortOrder), asc(checkLogPhotos.id));
}

async function findPhoto(id: number): Promise<CheckLogPhotoRow> {
  const rows = await db.select().from(checkLogPhotos).where(eq(checkLogPhotos.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Check log photo not found");
  return rows[0];
}

function parseId(value: string, message: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, message);
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
  return date;
}
