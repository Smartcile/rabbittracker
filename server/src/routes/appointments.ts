import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { Router } from "express";
import { appointmentToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import { appointments } from "../db/schema.ts";
import type { AppointmentRow } from "../db/schema.ts";
import {
  findVisibleRabbit,
  hideCosts,
  requirePermission,
  visibleRabbitIds,
} from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { appointmentCreateSchema, appointmentUpdateSchema } from "../lib/validation.ts";

export const appointmentsRouter = Router();

export function listAppointmentsForRabbit(rabbitId: number): Promise<AppointmentRow[]> {
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.rabbitId, rabbitId))
    .orderBy(desc(appointments.scheduledAt));
}

appointmentsRouter.get("/", requireAuth, async (req, res) => {
  const conditions = [];
  if (!req.user!.isAdmin) {
    conditions.push(inArray(appointments.rabbitId, visibleRabbitIds(req.user!)));
  }
  if (req.query.rabbitId !== undefined) {
    const rabbitId = Number(req.query.rabbitId);
    if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(400, "Invalid rabbitId");
    conditions.push(eq(appointments.rabbitId, rabbitId));
  }
  const from = parseQueryDate(req.query.from);
  if (from) conditions.push(gte(appointments.scheduledAt, from));
  const to = parseQueryDate(req.query.to);
  if (to) conditions.push(lte(appointments.scheduledAt, to));
  const rows = await db
    .select()
    .from(appointments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(appointments.scheduledAt));
  const hidden = hideCosts(req.user!);
  res.json({ appointments: rows.map((row) => appointmentToDto(row, hidden)) });
});

appointmentsRouter.post("/", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const input = parseInput(appointmentCreateSchema, req.body);
  await findVisibleRabbit(req.user!, input.rabbitId);
  const hidden = hideCosts(req.user!);
  const [row] = await db
    .insert(appointments)
    .values({
      rabbitId: input.rabbitId,
      title: input.title,
      clinic: input.clinic,
      vet: input.vet,
      location: input.location,
      scheduledAt: input.scheduledAt,
      status: input.status,
      costCents: hidden ? null : (input.costCents ?? null),
      followUpAt: input.followUpAt ?? null,
      eventUid: input.eventUid ?? null,
      notes: input.notes,
    })
    .returning();
  res.status(201).json({ appointment: appointmentToDto(row, hidden) });
});

appointmentsRouter.patch("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findAppointment(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  const hidden = hideCosts(req.user!);
  const input = parseInput(appointmentUpdateSchema, req.body);
  if (hidden) delete input.costCents;
  const [row] = await db
    .update(appointments)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();
  res.json({ appointment: appointmentToDto(row, hidden) });
});

appointmentsRouter.delete("/:id", requireAuth, requirePermission("canRecordHealth"), async (req, res) => {
  const id = parseId(String(req.params.id));
  const existing = await findAppointment(id);
  await findVisibleRabbit(req.user!, existing.rabbitId);
  await db.delete(appointments).where(eq(appointments.id, id));
  res.json({ ok: true });
});

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Appointment not found");
  return id;
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
  return date;
}

async function findAppointment(id: number): Promise<AppointmentRow> {
  const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Appointment not found");
  return rows[0];
}
