import { and, asc, desc, eq, gte, inArray, lte, max } from "drizzle-orm";
import { Router } from "express";
import { slugifyLabel } from "../../../shared/checklist.ts";
import { checkLogToDto, checkLogTypeToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { checkLogs, checkLogTypes } from "../db/schema.ts";
import type { CheckLogTypeRow } from "../db/schema.ts";
import { findVisibleRabbit, requirePermission, visibleRabbitIds } from "../lib/access.ts";
import { requireAdmin, requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import {
  checkLogCreateSchema,
  checkLogTypeCreateSchema,
  checkLogTypeUpdateSchema,
  checkLogUpdateSchema,
} from "../lib/validation.ts";

export const checkLogsRouter = Router();

export async function listCheckLogTypes(): Promise<CheckLogTypeRow[]> {
  return db
    .select()
    .from(checkLogTypes)
    .orderBy(asc(checkLogTypes.sortOrder), asc(checkLogTypes.id));
}

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
  res.json({ logs: rows.map((row) => checkLogToDto(row, types.get(row.typeId))) });
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
      valueText: input.valueText !== undefined ? input.valueText : existing.valueText,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    })
    .where(eq(checkLogs.id, id))
    .returning();
  const type = await findType(row.typeId);
  res.json({ log: checkLogToDto(row, type) });
});

checkLogsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id), "Check log not found");
  const existing = await findLog(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.delete(checkLogs).where(eq(checkLogs.id, id));
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
