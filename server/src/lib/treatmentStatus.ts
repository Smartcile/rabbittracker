import { inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { medicationLogs, treatments } from "../db/schema.ts";
import type { TreatmentRow } from "../db/schema.ts";
import { getSettings } from "./settingsStore.ts";

function localDateKey(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function autoCompleteTreatments(rows: TreatmentRow[]): Promise<TreatmentRow[]> {
  const candidates = rows.filter((row) => row.status === "active" && row.endDate !== null);
  if (candidates.length === 0) return rows;

  const settings = await getSettings();
  const today = localDateKey(new Date(), settings.timezone);
  const due = candidates.filter((row) => (row.endDate as string) < today);
  if (due.length === 0) return rows;

  const logs = await db
    .select()
    .from(medicationLogs)
    .where(inArray(medicationLogs.treatmentId, due.map((row) => row.id)));
  const finished = due.filter((row) => {
    const rowLogs = logs.filter((log) => log.treatmentId === row.id);
    if (rowLogs.length === 0) return false;
    const lastDay = rowLogs.reduce((latest, log) => {
      const key = localDateKey(log.givenAt, settings.timezone);
      return key > latest ? key : latest;
    }, "");
    return lastDay >= (row.endDate as string);
  });
  if (finished.length === 0) return rows;

  const finishedIds = new Set(finished.map((row) => row.id));
  await db
    .update(treatments)
    .set({ status: "completed", updatedAt: new Date() })
    .where(inArray(treatments.id, [...finishedIds]));
  return rows.map((row) => (finishedIds.has(row.id) ? { ...row, status: "completed" } : row));
}
