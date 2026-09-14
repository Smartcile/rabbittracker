import { and, asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { summarizeBowl } from "../../../shared/bowls.ts";
import { bowlToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { bowlReadings, bowls } from "../db/schema.ts";
import type { BowlReadingRow, BowlRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { bowlCreateSchema, bowlReadingCreateSchema, bowlUpdateSchema } from "../lib/validation.ts";

export const bowlsRouter = Router();

bowlsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(bowls.rabbitId, visibleRabbitIds(req.user!)));
  }
  const rabbitId = Number(req.query.rabbitId);
  if (Number.isInteger(rabbitId) && rabbitId > 0) conditions.push(eq(bowls.rabbitId, rabbitId));
  const bowlRows = await db
    .select()
    .from(bowls)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(bowls.id));
  const readings =
    bowlRows.length > 0
      ? await db
          .select()
          .from(bowlReadings)
          .where(inArray(bowlReadings.bowlId, bowlRows.map((row) => row.id)))
          .orderBy(asc(bowlReadings.readAt), asc(bowlReadings.id))
      : [];
  res.json({
    bowls: bowlRows.map((row) =>
      bowlToDto(
        row,
        readings.filter((reading) => reading.bowlId === row.id),
      ),
    ),
  });
});

bowlsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(bowlCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const [bowl] = await db
    .insert(bowls)
    .values({ rabbitId: input.rabbitId, label: input.label })
    .returning();
  const [reading] = await db
    .insert(bowlReadings)
    .values({
      bowlId: bowl.id,
      readAt: input.startedAt,
      kind: "start",
      weightGrams: input.startWeightGrams,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ bowl: bowlToDto(bowl, [reading]) });
});

bowlsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const bowl = await findBowl(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, bowl.rabbitId);
  const input = parseInput(bowlUpdateSchema, req.body);
  const [row] = await db
    .update(bowls)
    .set({ label: input.label, updatedAt: new Date() })
    .where(eq(bowls.id, bowl.id))
    .returning();
  res.json({ bowl: bowlToDto(row, await listReadings(bowl.id)) });
});

bowlsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const bowl = await findBowl(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, bowl.rabbitId);
  await db.delete(bowls).where(eq(bowls.id, bowl.id));
  res.json({ ok: true });
});

bowlsRouter.post("/:id/readings", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const bowl = await findBowl(parseId(String(req.params.id)));
  await findVisibleRabbit(req.user!, bowl.rabbitId);
  const input = parseInput(bowlReadingCreateSchema, req.body);
  const existing = await listReadings(bowl.id);
  const summary = summarizeBowl(existing);
  const added: BowlReadingRow[] = [];
  if (input.kind === "refresh" && input.finalWeightGrams !== undefined && input.finalWeightGrams !== summary.currentWeightGrams) {
    const [final] = await db
      .insert(bowlReadings)
      .values({ bowlId: bowl.id, readAt: input.readAt, kind: "weigh", weightGrams: input.finalWeightGrams })
      .returning();
    added.push(final);
  }
  let weightGrams: number;
  if (input.kind === "refill") {
    if (summary.currentWeightGrams === null) throw new HttpError(400, "Add a starting weight first");
    weightGrams = summary.currentWeightGrams + (input.refillGrams ?? 0);
  } else {
    weightGrams = input.weightGrams ?? 0;
  }
  const [reading] = await db
    .insert(bowlReadings)
    .values({
      bowlId: bowl.id,
      readAt: input.readAt,
      kind: input.kind,
      weightGrams,
      notes: input.notes,
    })
    .returning();
  added.push(reading);
  res.status(201).json({ bowl: bowlToDto(bowl, [...existing, ...added]) });
});

bowlsRouter.delete(
  "/:id/readings/:readingId",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const bowl = await findBowl(parseId(String(req.params.id)));
    await findVisibleRabbit(req.user!, bowl.rabbitId);
    const reading = await findReading(parseId(String(req.params.readingId)));
    if (reading.bowlId !== bowl.id) throw new HttpError(404, "Reading not found");
    await db.delete(bowlReadings).where(eq(bowlReadings.id, reading.id));
    res.json({ bowl: bowlToDto(bowl, await listReadings(bowl.id)) });
  },
);

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Bowl not found");
  return id;
}

async function findBowl(id: number): Promise<BowlRow> {
  const rows = await db.select().from(bowls).where(eq(bowls.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Bowl not found");
  return rows[0];
}

async function findReading(id: number): Promise<BowlReadingRow> {
  const rows = await db.select().from(bowlReadings).where(eq(bowlReadings.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Reading not found");
  return rows[0];
}

async function listReadings(bowlId: number): Promise<BowlReadingRow[]> {
  return db
    .select()
    .from(bowlReadings)
    .where(eq(bowlReadings.bowlId, bowlId))
    .orderBy(asc(bowlReadings.readAt), asc(bowlReadings.id));
}
