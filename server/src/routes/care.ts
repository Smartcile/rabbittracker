import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { careRecordToDto, careScheduleToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { careRecords, careSchedules } from "../db/schema.ts";
import type { CareRecordRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { lookupValues } from "../lib/lookupStore.ts";
import { careRecordCreateSchema, careSchedulePutSchema } from "../lib/validation.ts";

export const careRabbitRouter = Router();
export const careRecordsRouter = Router();

export function listSchedulesForRabbit(rabbitId: number) {
  return db.select().from(careSchedules).where(eq(careSchedules.rabbitId, rabbitId));
}

export function listRecordsForRabbit(rabbitId: number): Promise<CareRecordRow[]> {
  return db
    .select()
    .from(careRecords)
    .where(eq(careRecords.rabbitId, rabbitId))
    .orderBy(desc(careRecords.doneAt));
}

careRabbitRouter.get("/:id/care-schedules", requireAuth, async (req, res) => {
  const rabbit = await findVisibleRabbit(req.user!, parseRabbitId(String(req.params.id)));
  const rows = await listSchedulesForRabbit(rabbit.id);
  res.json({ schedules: rows.map(careScheduleToDto) });
});

careRabbitRouter.put(
  "/:id/care-schedules",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const rabbitId = (await findVisibleRabbit(req.user!, parseRabbitId(String(req.params.id)))).id;
    const input = parseInput(careSchedulePutSchema, req.body);
    await requireCareKind(input.kind);
    const [row] = await db
      .insert(careSchedules)
      .values({ rabbitId, kind: input.kind, intervalDays: input.intervalDays })
      .onConflictDoUpdate({
        target: [careSchedules.rabbitId, careSchedules.kind],
        set: { intervalDays: input.intervalDays, updatedAt: new Date() },
      })
      .returning();
    res.json({ schedule: careScheduleToDto(row) });
  },
);

careRecordsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(careRecords.rabbitId, visibleRabbitIds(req.user!)));
  }
  if (req.query.rabbitId !== undefined) {
    const rabbitId = Number(req.query.rabbitId);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(400, "Invalid rabbitId");
    conditions.push(eq(careRecords.rabbitId, rabbitId));
  }
  if (req.query.kind !== undefined) {
    const kind = String(req.query.kind);
    if (kind !== "nails" && kind !== "teeth" && kind !== "grooming") {
      throw new HttpError(400, "Invalid kind");
    }
    conditions.push(eq(careRecords.kind, kind));
  }
  const rows = await db
    .select()
    .from(careRecords)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(careRecords.doneAt));
  res.json({ records: rows.map(careRecordToDto) });
});

careRecordsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(careRecordCreateSchema, req.body);
  await requireCareKind(input.kind);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [row] = await db
    .insert(careRecords)
    .values({
      rabbitId: input.rabbitId,
      kind: input.kind,
      doneAt: input.doneAt,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ record: careRecordToDto(row) });
});

careRecordsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Care record not found");
  const rows = await db.select().from(careRecords).where(eq(careRecords.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Care record not found");
  await findVisibleRabbit(req.user!, rows[0].rabbitId);
  await db.delete(careRecords).where(eq(careRecords.id, id));
  res.json({ ok: true });
});

function parseRabbitId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Rabbit not found");
  return id;
}

async function requireCareKind(kind: string): Promise<void> {
  const values = await lookupValues("care_type");
  if (!values.includes(kind)) throw new HttpError(400, "Unknown care type");
}
