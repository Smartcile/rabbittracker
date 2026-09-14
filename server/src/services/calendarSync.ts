import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { appointments, calendarEvents, calendarSubscriptions } from "../db/schema.ts";
import type { CalendarSubscriptionRow } from "../db/schema.ts";
import { parseIcs } from "./ical.ts";

export type SyncResult = {
  added: number;
  updated: number;
  removed: number;
  total: number;
};

export type SubscriptionSyncOutcome = {
  id: number;
  label: string;
  ok: boolean;
  result?: SyncResult;
  error?: string;
};

export function uidsToPrune(existing: string[], seen: Set<string>, linked: Set<string>): string[] {
  return existing.filter((uid) => !seen.has(uid) && !linked.has(uid));
}

export async function updateSubscriptionSyncState(
  id: number,
  lastSyncAt: Date | null,
  syncError: string | null,
): Promise<void> {
  const patch: Partial<typeof calendarSubscriptions.$inferInsert> = {
    syncError,
    updatedAt: new Date(),
  };
  if (lastSyncAt) patch.lastSyncAt = lastSyncAt;
  await db.update(calendarSubscriptions).set(patch).where(eq(calendarSubscriptions.id, id));
}

export async function syncSubscription(subscription: CalendarSubscriptionRow): Promise<SyncResult> {
  const fetchUrl = subscription.url.replace(/^webcal:\/\//i, "https://");
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Calendar fetch failed (${response.status})`);
  const text = await response.text();
  const parsed = parseIcs(text).filter((event) => !event.cancelled);

  const seen = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const event of parsed) {
    seen.add(event.uid);
    const values = {
      summary: event.summary,
      location: event.location,
      description: event.description,
      startAt: event.startAt ? new Date(event.startAt) : null,
      endAt: event.endAt ? new Date(event.endAt) : null,
      allDay: event.allDay,
    };
    const existing = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.subscriptionId, subscription.id), eq(calendarEvents.uid, event.uid)),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(calendarEvents)
        .set(values)
        .where(
          and(eq(calendarEvents.subscriptionId, subscription.id), eq(calendarEvents.uid, event.uid)),
        );
      updated += 1;
    } else {
      await db
        .insert(calendarEvents)
        .values({ subscriptionId: subscription.id, uid: event.uid, ...values });
      added += 1;
    }
  }

  const rows = await db
    .select({ uid: calendarEvents.uid })
    .from(calendarEvents)
    .where(eq(calendarEvents.subscriptionId, subscription.id));
  const linkedRows = await db
    .select({ eventUid: appointments.eventUid })
    .from(appointments)
    .where(isNotNull(appointments.eventUid));
  const linked = new Set(linkedRows.map((row) => row.eventUid as string));
  const prune = uidsToPrune(
    rows.map((row) => row.uid),
    seen,
    linked,
  );
  for (const uid of prune) {
    await db
      .delete(calendarEvents)
      .where(
        and(eq(calendarEvents.subscriptionId, subscription.id), eq(calendarEvents.uid, uid)),
      );
  }

  return { added, updated, removed: prune.length, total: parsed.length };
}

export async function syncAllSubscriptions(): Promise<SubscriptionSyncOutcome[]> {
  const subscriptions = await db.select().from(calendarSubscriptions);
  const outcomes: SubscriptionSyncOutcome[] = [];
  for (const subscription of subscriptions) {
    try {
      const result = await syncSubscription(subscription);
      await updateSubscriptionSyncState(subscription.id, new Date(), null);
      outcomes.push({ id: subscription.id, label: subscription.label, ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Calendar sync failed";
      await updateSubscriptionSyncState(subscription.id, null, message);
      outcomes.push({ id: subscription.id, label: subscription.label, ok: false, error: message });
    }
  }
  return outcomes;
}
