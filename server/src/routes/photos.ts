import { eq } from "drizzle-orm";
import { Router } from "express";
import multer from "multer";
import { db } from "../db/index.ts";
import { checkLogPhotos, checkLogs, healthChecks, journalEntries, journalPhotos } from "../db/schema.ts";
import { findVisibleRabbit } from "../lib/access.ts";
import { optionalAuth } from "../lib/auth.ts";
import type { SessionUser } from "../lib/auth.ts";
import { HttpError } from "../lib/http.ts";
import { isValidShareToken } from "../lib/settingsStore.ts";
import { findPhotoFile } from "../services/photos.ts";
import type { PhotoKind, PhotoSize } from "../services/photos.ts";

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const photosRouter = Router();

photosRouter.get("/:kind/:id", optionalAuth, async (req, res) => {
  const kind = req.params.kind;
  if (
    kind !== "check" &&
    kind !== "rabbit" &&
    kind !== "checklist" &&
    kind !== "journal" &&
    kind !== "checklog"
  ) {
    throw new HttpError(404, "Not found");
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found");
  const shareToken = typeof req.query.token === "string" ? req.query.token : "";
  if (!req.user && !(await isValidShareToken(shareToken))) {
    throw new HttpError(401, "Authentication required");
  }
  if (req.user) await assertPhotoAccess(req.user, kind, id);
  const requested = String(req.query.size ?? "full");
  const size: PhotoSize = requested === "thumb" || requested === "orig" ? requested : "full";
  const file = await findPhotoFile(kind as PhotoKind, id, size);
  if (!file) throw new HttpError(404, "Not found");
  res.sendFile(file, { headers: { "Cache-Control": "private, max-age=300" } });
});

async function assertPhotoAccess(user: SessionUser, kind: string, id: number): Promise<void> {
  if (kind === "rabbit") {
    await findVisibleRabbit(user, id);
    return;
  }
  if (kind === "check") {
    const rows = await db
      .select({ rabbitId: healthChecks.rabbitId })
      .from(healthChecks)
      .where(eq(healthChecks.id, id))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, "Not found");
    await findVisibleRabbit(user, rows[0].rabbitId);
    return;
  }
  if (kind === "journal") {
    const photoRows = await db
      .select({ entryId: journalPhotos.entryId })
      .from(journalPhotos)
      .where(eq(journalPhotos.id, id))
      .limit(1);
    if (!photoRows[0]) throw new HttpError(404, "Not found");
    const entryRows = await db
      .select({ rabbitId: journalEntries.rabbitId })
      .from(journalEntries)
      .where(eq(journalEntries.id, photoRows[0].entryId))
      .limit(1);
    if (!entryRows[0]) throw new HttpError(404, "Not found");
    await findVisibleRabbit(user, entryRows[0].rabbitId);
    return;
  }
  if (kind === "checklog") {
    const photoRows = await db
      .select({ logId: checkLogPhotos.logId })
      .from(checkLogPhotos)
      .where(eq(checkLogPhotos.id, id))
      .limit(1);
    if (!photoRows[0]) throw new HttpError(404, "Not found");
    const logRows = await db
      .select({ rabbitId: checkLogs.rabbitId })
      .from(checkLogs)
      .where(eq(checkLogs.id, photoRows[0].logId))
      .limit(1);
    if (!logRows[0]) throw new HttpError(404, "Not found");
    await findVisibleRabbit(user, logRows[0].rabbitId);
  }
}
