import { asc, eq, lte } from "drizzle-orm";
import { Router } from "express";
import { calendarEntryToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { calendarEntries } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  calendarEntryCreateSchema,
  calendarEntryUpdateSchema,
} from "../lib/validation.ts";

export const calendarEntriesRouter = Router();

calendarEntriesRouter.get("/", requireAuth, async (req, res) => {
  const from = parseQueryDate(req.query.from) ?? new Date(Date.now() - 180 * 86_400_000);
  const to = parseQueryDate(req.query.to) ?? new Date(Date.now() + 365 * 86_400_000);
  const rows = await db
    .select()
    .from(calendarEntries)
    .where(lte(calendarEntries.startAt, to))
    .orderBy(asc(calendarEntries.startAt));
  res.json({
    entries: rows
      .filter((row) => row.repeat !== "none" || row.startAt >= from)
      .map(calendarEntryToDto),
  });
});

calendarEntriesRouter.post(
  "/",
  requireAuth,
  requirePermission("canManageCalendar"),
  async (req, res) => {
    const input = parseInput(calendarEntryCreateSchema, req.body);
    if (input.rabbitId != null) await findVisibleRabbit(req.user!, input.rabbitId);
    const [row] = await db
      .insert(calendarEntries)
      .values({
        title: input.title,
        type: input.type,
        startAt: input.startAt,
        allDay: input.allDay,
        location: input.location,
        notes: input.notes,
        rabbitId: input.rabbitId ?? null,
        repeat: input.repeat,
        repeatUntil: input.repeatUntil ?? null,
      })
      .returning();
    res.status(201).json({ entry: calendarEntryToDto(row) });
  },
);

calendarEntriesRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("canManageCalendar"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    const existing = await findEntry(id);
    const input = parseInput(calendarEntryUpdateSchema, req.body);
    if (input.rabbitId != null) await findVisibleRabbit(req.user!, input.rabbitId);
    const [row] = await db
      .update(calendarEntries)
      .set({
        title: input.title ?? existing.title,
        type: input.type ?? existing.type,
        startAt: input.startAt ?? existing.startAt,
        allDay: input.allDay ?? existing.allDay,
        location: input.location ?? existing.location,
        notes: input.notes ?? existing.notes,
        rabbitId: input.rabbitId !== undefined ? input.rabbitId : existing.rabbitId,
        repeat: input.repeat ?? existing.repeat,
        repeatUntil: input.repeatUntil !== undefined ? input.repeatUntil : existing.repeatUntil,
        updatedAt: new Date(),
      })
      .where(eq(calendarEntries.id, id))
      .returning();
    res.json({ entry: calendarEntryToDto(row) });
  },
);

calendarEntriesRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("canManageCalendar"),
  async (req, res) => {
    const id = parseId(String(req.params.id));
    await findEntry(id);
    await db.delete(calendarEntries).where(eq(calendarEntries.id, id));
    res.json({ ok: true });
  },
);

async function findEntry(id: number) {
  const rows = await db.select().from(calendarEntries).where(eq(calendarEntries.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Event not found");
  return rows[0];
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Event not found");
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
  return date;
}
