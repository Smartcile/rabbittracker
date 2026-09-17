import { and, asc, desc, eq, gte, inArray, lt, lte, min, ne, or } from "drizzle-orm";
import { Router } from "express";
import { summarizeBowl } from "../../../shared/bowls.ts";
import { DEFAULT_RECURRENCE, normalizeRecurrence } from "../../../shared/recurrence.ts";
import type { DaySlot } from "../../../shared/slots.ts";
import { bowlToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { bowlReadings, bowls, foodProducts, foodStockEntries } from "../db/schema.ts";
import type { BowlReadingRow, BowlRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  bowlCreateSchema,
  bowlReadingBatchSchema,
  bowlReadingCreateSchema,
  bowlReadingUpdateSchema,
  bowlUpdateSchema,
} from "../lib/validation.ts";
import type { BowlReadingCreateInput } from "../lib/validation.ts";

export const bowlsRouter = Router();

type BowlTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

bowlsRouter.get("/schedule", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(bowls.rabbitId, visibleRabbitIds(req.user!)));
  }
  const bowlRows = await db
    .select()
    .from(bowls)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(bowls.id));
  const scheduled = bowlRows.filter(
    (row) => row.slots.length > 0 || normalizeRecurrence(row.recurrence).kind !== "daily",
  );
  const from = parseQueryDate(req.query.from);
  const to = parseQueryDate(req.query.to);
  const readingConditions = [];
  if (from) readingConditions.push(gte(bowlReadings.readAt, from));
  if (to) readingConditions.push(lte(bowlReadings.readAt, to));
  const readings =
    scheduled.length > 0
      ? await db
          .select()
          .from(bowlReadings)
          .where(
            and(
              inArray(
                bowlReadings.bowlId,
                scheduled.map((row) => row.id),
              ),
              ...readingConditions,
            ),
          )
          .orderBy(asc(bowlReadings.readAt), asc(bowlReadings.id))
      : [];
  const startRows =
    scheduled.length > 0
      ? await db
          .select({ bowlId: bowlReadings.bowlId, startedAt: min(bowlReadings.readAt) })
          .from(bowlReadings)
          .where(
            inArray(
              bowlReadings.bowlId,
              scheduled.map((row) => row.id),
            ),
          )
          .groupBy(bowlReadings.bowlId)
      : [];
  const startByBowl = new Map(startRows.map((row) => [row.bowlId, row.startedAt]));
  res.json({
    bowls: scheduled.map((row) =>
      bowlToDto(
        row,
        readings.filter((reading) => reading.bowlId === row.id),
        startByBowl.get(row.id) ?? null,
      ),
    ),
  });
});

bowlsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(bowlCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  await findProducts(input.productIds);
  const [bowl] = await db
    .insert(bowls)
    .values({
      rabbitId: input.rabbitId,
      label: input.label,
      kind: input.kind,
      slots: input.slots,
      recurrence: input.recurrence ?? DEFAULT_RECURRENCE,
      tareGrams: input.tareGrams ?? null,
      productIds: input.productIds,
    })
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
  if (input.productIds !== undefined) await findProducts(input.productIds);
  const [row] = await db
    .update(bowls)
    .set({
      label: input.label ?? bowl.label,
      kind: input.kind ?? bowl.kind,
      slots: input.slots ?? bowl.slots,
      recurrence: input.recurrence ?? bowl.recurrence,
      tareGrams: input.tareGrams !== undefined ? input.tareGrams : bowl.tareGrams,
      productIds: input.productIds ?? bowl.productIds,
      updatedAt: new Date(),
    })
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
  const rows = await listReadings(bowl.id);
  await db.transaction(async (tx) => {
    await applyReading(tx, bowl, rows, input);
  });
  res.status(201).json({ bowl: bowlToDto(bowl, await listReadings(bowl.id)) });
});

bowlsRouter.post(
  "/:id/readings/batch",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const bowl = await findBowl(parseId(String(req.params.id)));
    await findVisibleRabbit(req.user!, bowl.rabbitId);
    const input = parseInput(bowlReadingBatchSchema, req.body);
    const rows = await listReadings(bowl.id);
    const ordered = [...input.readings].sort((a, b) => a.readAt.getTime() - b.readAt.getTime());
    await db.transaction(async (tx) => {
      for (const reading of ordered) await applyReading(tx, bowl, rows, reading);
    });
    res.status(201).json({ bowl: bowlToDto(bowl, await listReadings(bowl.id)) });
  },
);

bowlsRouter.patch(
  "/:id/readings/:readingId",
  requireAuth,
  requirePermission("canRecordHealth"),
  async (req, res) => {
    const bowl = await findBowl(parseId(String(req.params.id)));
    await findVisibleRabbit(req.user!, bowl.rabbitId);
    const reading = await findReading(parseId(String(req.params.readingId)));
    if (reading.bowlId !== bowl.id) throw new HttpError(404, "Reading not found");
    const input = parseInput(bowlReadingUpdateSchema, req.body);
    const readAt = input.readAt ?? reading.readAt;
    let weightGrams = reading.weightGrams;
    if (reading.kind === "refill") {
      if (input.refillGrams !== undefined) {
        const previous = await previousReading(bowl.id, readAt, reading.id);
        weightGrams = (previous?.weightGrams ?? 0) + input.refillGrams;
      }
    } else if (input.weightGrams !== undefined) {
      weightGrams = input.weightGrams;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(bowlReadings)
        .set({
          readAt,
          slot: input.slot !== undefined ? input.slot : reading.slot,
          weightGrams,
          notes: input.notes ?? reading.notes,
        })
        .where(eq(bowlReadings.id, reading.id));
      if (reading.kind === "refill") {
        const entries = await tx
          .select()
          .from(foodStockEntries)
          .where(eq(foodStockEntries.bowlReadingId, reading.id))
          .limit(1);
        if (entries[0]) {
          const patch: { amountGrams?: number; productId?: number } = {};
          if (input.refillGrams !== undefined) patch.amountGrams = -input.refillGrams;
          if (input.productId) patch.productId = input.productId;
          if (Object.keys(patch).length > 0) {
            await tx
              .update(foodStockEntries)
              .set(patch)
              .where(eq(foodStockEntries.id, entries[0].id));
          }
        } else if (input.refillGrams !== undefined) {
          const productId = input.productId ?? bowl.productIds[0] ?? null;
          if (productId !== null) {
            await tx.insert(foodStockEntries).values({
              productId,
              bowlReadingId: reading.id,
              amountGrams: -input.refillGrams,
              note: `Bowl top-up: ${bowl.label}`,
            });
          }
        }
      }
    });
    res.json({ bowl: bowlToDto(bowl, await listReadings(bowl.id)) });
  },
);

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

async function applyReading(
  tx: BowlTx,
  bowl: BowlRow,
  rows: BowlReadingRow[],
  input: BowlReadingCreateInput,
): Promise<void> {
  const summary = summarizeBowl(rows);
  const slot: DaySlot | null =
    input.slot ?? (bowl.slots.length === 1 ? (bowl.slots[0] as DaySlot) : null);
  let weightGrams: number;
  if (input.kind === "refill") {
    const base = input.preWeightGrams ?? summary.currentWeightGrams;
    if (base === null) throw new HttpError(400, "Add a starting weight first");
    weightGrams = base + (input.refillGrams ?? 0);
  } else if (input.kind === "consume") {
    if (summary.currentWeightGrams === null) throw new HttpError(400, "Add a starting weight first");
    if ((input.consumedGrams ?? 0) > summary.currentWeightGrams) {
      throw new HttpError(400, "That is more than the bowl holds");
    }
    weightGrams = summary.currentWeightGrams - (input.consumedGrams ?? 0);
  } else {
    weightGrams = input.weightGrams ?? 0;
  }
  if (
    input.kind === "refresh" &&
    input.finalWeightGrams !== undefined &&
    input.finalWeightGrams !== summary.currentWeightGrams
  ) {
    const [final] = await tx
      .insert(bowlReadings)
      .values({ bowlId: bowl.id, readAt: input.readAt, kind: "weigh", weightGrams: input.finalWeightGrams })
      .returning();
    rows.push(final);
  }
  if (
    input.kind === "refill" &&
    input.preWeightGrams !== undefined &&
    input.preWeightGrams !== summary.currentWeightGrams
  ) {
    const [weighed] = await tx
      .insert(bowlReadings)
      .values({
        bowlId: bowl.id,
        readAt: input.readAt,
        kind: "weigh",
        weightGrams: input.preWeightGrams,
        notes: "",
      })
      .returning();
    rows.push(weighed);
  }
  const [reading] = await tx
    .insert(bowlReadings)
    .values({
      bowlId: bowl.id,
      readAt: input.readAt,
      kind: input.kind,
      slot,
      weightGrams,
      notes: input.notes,
    })
    .returning();
  rows.push(reading);
  const stockProductId = input.productId ?? bowl.productIds[0] ?? null;
  if (input.kind === "refill" && stockProductId !== null && (input.refillGrams ?? 0) > 0) {
    await tx.insert(foodStockEntries).values({
      productId: stockProductId,
      bowlReadingId: reading.id,
      amountGrams: -(input.refillGrams ?? 0),
      note: `Bowl top-up: ${bowl.label}`,
    });
  }
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Bowl not found");
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function findBowl(id: number): Promise<BowlRow> {
  const rows = await db.select().from(bowls).where(eq(bowls.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Bowl not found");
  return rows[0];
}

async function findProducts(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: foodProducts.id })
    .from(foodProducts)
    .where(inArray(foodProducts.id, ids));
  if (rows.length !== new Set(ids).size) throw new HttpError(400, "Product not found");
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

async function previousReading(
  bowlId: number,
  before: Date,
  excludeId: number,
): Promise<BowlReadingRow | null> {
  const rows = await db
    .select()
    .from(bowlReadings)
    .where(
      and(
        eq(bowlReadings.bowlId, bowlId),
        ne(bowlReadings.id, excludeId),
        or(
          lt(bowlReadings.readAt, before),
          and(eq(bowlReadings.readAt, before), lt(bowlReadings.id, excludeId)),
        ),
      ),
    )
    .orderBy(desc(bowlReadings.readAt), desc(bowlReadings.id))
    .limit(1);
  return rows[0] ?? null;
}
