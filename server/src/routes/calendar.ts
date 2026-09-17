import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Router } from "express";
import type { Request, Response } from "express";
import { calendarEventToDto, calendarSubscriptionToDto, settingsToDto } from "../api/mappers.ts";
import { db } from "../db/index.ts";
import {
  appointments,
  calendarEvents,
  calendarSubscriptions,
  healthChecks,
  rabbitTasks,
  rabbits,
  taskCompletions,
  treatments,
  vaccinations,
} from "../db/schema.ts";
import type { CalendarSubscriptionRow } from "../db/schema.ts";
import { hasPermission, requirePermission } from "../lib/access.ts";
import { requireAuth } from "../lib/auth.ts";
import { HttpError, parseInput } from "../lib/http.ts";
import { ensureFeedToken, getSettings, regenerateFeedToken } from "../lib/settingsStore.ts";
import { tokenMatches } from "../lib/tokens.ts";
import { normalizeRecurrence } from "../../../shared/recurrence.ts";
import {
  calendarSubscriptionSchema,
  calendarSubscriptionUpdateSchema,
} from "../lib/validation.ts";
import { syncAllSubscriptions, syncSubscription, updateSubscriptionSyncState } from "../services/calendarSync.ts";
import { buildFeedEvents, buildIcs } from "../services/icsExport.ts";

export const calendarRouter = Router();

calendarRouter.get("/feed/:token.ics", async (req, res) => {
  await sendFeed(req, res, null);
});

calendarRouter.get("/feed/:token/:rabbitId.ics", async (req, res) => {
  const rabbitId = Number(req.params.rabbitId);
  if (!Number.isInteger(rabbitId) || rabbitId <= 0) throw new HttpError(404, "Not found");
  await sendFeed(req, res, rabbitId);
});

calendarRouter.get("/subscriptions", requireAuth, requirePermission("canManageCalendar"), async (_req, res) => {
  const rows = await db.select().from(calendarSubscriptions).orderBy(asc(calendarSubscriptions.id));
  res.json({ subscriptions: rows.map(calendarSubscriptionToDto) });
});

calendarRouter.post("/subscriptions", requireAuth, requirePermission("canManageCalendar"), async (req, res) => {
  const input = parseInput(calendarSubscriptionSchema, req.body);
  const [row] = await db.insert(calendarSubscriptions).values(input).returning();
  res.status(201).json({ subscription: calendarSubscriptionToDto(row) });
});

calendarRouter.patch("/subscriptions/:id", requireAuth, requirePermission("canManageCalendar"), async (req, res) => {
  const id = parseSubscriptionId(String(req.params.id));
  await findSubscription(id);
  const input = parseInput(calendarSubscriptionUpdateSchema, req.body);
  const [row] = await db
    .update(calendarSubscriptions)
    .set({ ...input, syncError: null, updatedAt: new Date() })
    .where(eq(calendarSubscriptions.id, id))
    .returning();
  res.json({ subscription: calendarSubscriptionToDto(row) });
});

calendarRouter.delete("/subscriptions/:id", requireAuth, requirePermission("canManageCalendar"), async (req, res) => {
  const id = parseSubscriptionId(String(req.params.id));
  await findSubscription(id);
  await db.delete(calendarSubscriptions).where(eq(calendarSubscriptions.id, id));
  res.json({ ok: true });
});

calendarRouter.post("/subscriptions/:id/sync", requireAuth, requirePermission("canManageCalendar"), async (req, res) => {
  const id = parseSubscriptionId(String(req.params.id));
  const subscription = await findSubscription(id);
  try {
    const result = await syncSubscription(subscription);
    await updateSubscriptionSyncState(subscription.id, new Date(), null);
    const updated = await findSubscription(id);
    res.json({ result, subscription: calendarSubscriptionToDto(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar sync failed";
    await updateSubscriptionSyncState(subscription.id, null, message);
    throw new HttpError(502, message);
  }
});

calendarRouter.post("/sync", requireAuth, requirePermission("canManageCalendar"), async (_req, res) => {
  const outcomes = await syncAllSubscriptions();
  const totals = outcomes.reduce(
    (acc, outcome) => ({
      added: acc.added + (outcome.result?.added ?? 0),
      updated: acc.updated + (outcome.result?.updated ?? 0),
      removed: acc.removed + (outcome.result?.removed ?? 0),
      total: acc.total + (outcome.result?.total ?? 0),
    }),
    { added: 0, updated: 0, removed: 0, total: 0 },
  );
  res.json({ outcomes, totals });
});

calendarRouter.get("/events", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!, "canManageCalendar")) {
    res.json({ events: [] });
    return;
  }
  const from = parseQueryDate(req.query.from) ?? new Date(Date.now() - 30 * 86_400_000);
  const to = parseQueryDate(req.query.to) ?? new Date(Date.now() + 60 * 86_400_000);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(gte(calendarEvents.startAt, from), lte(calendarEvents.startAt, to)))
    .orderBy(asc(calendarEvents.startAt));
  res.json({ events: rows.map(calendarEventToDto) });
});

calendarRouter.post("/feed-token/regenerate", requireAuth, requirePermission("canManageCalendar"), async (_req, res) => {
  await regenerateFeedToken();
  res.json({ settings: settingsToDto(await getSettings()) });
});

async function sendFeed(req: Request, res: Response, rabbitId: number | null): Promise<void> {
  const settings = await getSettings();
  const token = String(req.params.token);
  if (!settings.feedToken || !tokenMatches(token, settings.feedToken)) {
    throw new HttpError(404, "Not found");
  }

  const [rabbitRows, appointmentRows, vaccinationRows, taskRows, completionRows, checkRows, treatmentRows] =
    await Promise.all([
      db.select().from(rabbits).orderBy(asc(rabbits.name)),
      db.select().from(appointments),
      db.select().from(vaccinations),
      db.select().from(rabbitTasks),
      db.select().from(taskCompletions),
      db.select().from(healthChecks),
      db.select().from(treatments),
    ]);

  const rabbitName = rabbitId !== null ? rabbitRows.find((row) => row.id === rabbitId)?.name : undefined;
  if (rabbitId !== null && !rabbitName) throw new HttpError(404, "Not found");

  const lastByTask = new Map<number, Date>();
  for (const completion of completionRows) {
    const existing = lastByTask.get(completion.taskId);
    if (!existing || completion.completedAt > existing) {
      lastByTask.set(completion.taskId, completion.completedAt);
    }
  }

  const events = buildFeedEvents(
    {
      rabbits: rabbitRows.map((row) => ({ id: row.id, name: row.name })),
      appointments: appointmentRows,
      vaccinations: vaccinationRows,
      tasks: taskRows.map((row) => ({
        id: row.id,
        rabbitId: row.rabbitId,
        label: row.label,
        careKind: row.careKind,
        recurrence: normalizeRecurrence(row.recurrence),
        intervalDays: row.intervalDays,
        lastCompletedAt: lastByTask.get(row.id) ?? null,
      })),
      healthChecks: checkRows,
      treatments: treatmentRows,
    },
    rabbitId ?? undefined,
  );

  const ics = buildIcs({
    calendarName: rabbitName ? `RabbitTracker — ${rabbitName}` : "RabbitTracker",
    events,
    now: new Date(),
  });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="rabbittracker.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.send(ics);
}

function parseSubscriptionId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Subscription not found");
  return id;
}

async function findSubscription(id: number): Promise<CalendarSubscriptionRow> {
  const rows = await db
    .select()
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.id, id))
    .limit(1);
  if (!rows[0]) throw new HttpError(404, "Subscription not found");
  return rows[0];
}

function parseQueryDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date");
  return date;
}
