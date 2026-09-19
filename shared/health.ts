import {
  DEFAULT_RECURRENCE,
  isScheduledOn,
  recurrenceDays,
  type Recurrence,
} from "./recurrence.ts";
import { allSlotsDone, type DaySlot } from "./slots.ts";

export const WEIGHT_WATCH_PCT = 2;
export const WEIGHT_ALERT_PCT = 5;
export const WEIGHT_ALERT_FAST_PCT = 5;
export const WEIGHT_ALERT_FAST_DAYS = 14;
export const WEIGHT_ALERT_EXTREME_PCT = 8;
export const WEIGHT_ALERT_EXTREME_DAYS = 30;

export type WeightAssessment = "ok" | "watch" | "alert";

export function formatWeight(grams: number | null | undefined): string {
  if (grams === null || grams === undefined) return "—";
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${Math.round(grams)} g`;
}

export function weightInputValue(grams: number | null | undefined): string {
  if (grams === null || grams === undefined) return "";
  const kg = grams / 1000;
  return kg.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseWeightInput(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  const gramMatch = /^([0-9]+(?:\.[0-9]+)?)\s*g$/.exec(value);
  if (gramMatch) return Math.round(Number(gramMatch[1]));
  const kgMatch = /^([0-9]+(?:\.[0-9]+)?)\s*(?:kg)?$/.exec(value);
  if (!kgMatch) return null;
  return Math.round(Number(kgMatch[1]) * 1000);
}

export function weightDeltaGrams(prev: number, curr: number): number {
  return curr - prev;
}

export function weightChangePct(prev: number, curr: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

export function assessWeightChange(
  prevGrams: number,
  currGrams: number,
  daysBetween: number,
): WeightAssessment {
  if (currGrams >= prevGrams || prevGrams <= 0) return "ok";
  const lossPct = ((prevGrams - currGrams) / prevGrams) * 100;
  if (lossPct <= WEIGHT_WATCH_PCT) return "ok";
  if (lossPct > WEIGHT_ALERT_PCT) return "alert";
  if (lossPct > WEIGHT_ALERT_FAST_PCT && daysBetween <= WEIGHT_ALERT_FAST_DAYS) return "alert";
  if (lossPct > WEIGHT_ALERT_EXTREME_PCT && daysBetween <= WEIGHT_ALERT_EXTREME_DAYS) return "alert";
  return "watch";
}

export type WeightPoint = {
  checkedAt: string;
  weightGrams: number;
};

export type WeightTrend = {
  points: WeightPoint[];
  latest: number | null;
  previous: number | null;
  min: number | null;
  max: number | null;
  average: number | null;
  changeFromFirst: number | null;
  changeFromPrevious: number | null;
};

export function weightTrend(
  checks: { checkedAt: string; weightGrams: number | null }[],
): WeightTrend {
  const points: WeightPoint[] = checks
    .filter((check): check is { checkedAt: string; weightGrams: number } => check.weightGrams !== null)
    .map((check) => ({ checkedAt: check.checkedAt, weightGrams: check.weightGrams }))
    .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

  if (points.length === 0) {
    return {
      points: [],
      latest: null,
      previous: null,
      min: null,
      max: null,
      average: null,
      changeFromFirst: null,
      changeFromPrevious: null,
    };
  }

  const weights = points.map((point) => point.weightGrams);
  const latest = points[points.length - 1].weightGrams;
  const previous = points.length > 1 ? points[points.length - 2].weightGrams : null;
  return {
    points,
    latest,
    previous,
    min: Math.min(...weights),
    max: Math.max(...weights),
    average: Math.round(weights.reduce((sum, value) => sum + value, 0) / weights.length),
    changeFromFirst: latest - points[0].weightGrams,
    changeFromPrevious: previous === null ? null : latest - previous,
  };
}

export function weightSummary(points: { checkedAt: string; weightGrams: number }[]): {
  latestWeightGrams: number | null;
  weightChangeGrams: number | null;
  weightAlert: WeightAssessment | null;
} {
  const trend = weightTrend(points);
  if (trend.latest === null || trend.previous === null) {
    return { latestWeightGrams: trend.latest, weightChangeGrams: null, weightAlert: null };
  }
  const last = trend.points[trend.points.length - 1];
  const prev = trend.points[trend.points.length - 2];
  const days = Math.max(
    0,
    Math.round((Date.parse(last.checkedAt) - Date.parse(prev.checkedAt)) / 86_400_000),
  );
  return {
    latestWeightGrams: trend.latest,
    weightChangeGrams: trend.changeFromPrevious,
    weightAlert: assessWeightChange(trend.previous, trend.latest, days),
  };
}

export function validateBodyCondition(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export type DueStatus = "none" | "ok" | "due-soon" | "overdue";

function utcDay(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function todayUtc(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function dueStatus(
  nextDueAt: string | null | undefined,
  now: Date,
  soonDays = 30,
): DueStatus {
  if (!nextDueAt) return "none";
  const due = utcDay(nextDueAt);
  if (due === null) return "none";
  const days = Math.round((due - todayUtc(now)) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= soonDays) return "due-soon";
  return "ok";
}

export function careDueStatus(
  lastDoneAt: string | null | undefined,
  intervalDays: number,
  now: Date,
  soonDays = 7,
): DueStatus {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return "none";
  if (!lastDoneAt) return "overdue";
  const last = utcDay(lastDoneAt);
  if (last === null) return "overdue";
  const due = last + intervalDays * 86_400_000;
  const days = Math.round((due - todayUtc(now)) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= soonDays) return "due-soon";
  return "ok";
}

export function dayKeyInZone(date: Date, timeZone?: string): string | null {
  if (Number.isNaN(date.getTime())) return null;
  if (!timeZone) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function addDaysToKey(key: string, days: number): string | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day) + days * 86_400_000).toISOString().slice(0, 10);
}

function usesRecurrence(recurrence: Recurrence | undefined): recurrence is Recurrence {
  return recurrence?.kind === "weekdays" || recurrence?.kind === "per_week";
}

function recurrenceAnchor(
  startDate: string | null | undefined,
  lastCompletedAt: string | null | undefined,
  completionDays: readonly string[],
  timeZone?: string,
): string | null {
  if (startDate) return startDate;
  if (completionDays.length > 0) return [...completionDays].sort()[0];
  if (lastCompletedAt) return dayKeyInZone(new Date(lastCompletedAt), timeZone);
  return null;
}

export function taskNextDueOn(
  startDate: string | null | undefined,
  lastCompletedAt: string | null | undefined,
  intervalDays: number,
  timeZone?: string,
  recurrence?: Recurrence,
  completionDays: readonly string[] = [],
  now: Date = new Date(),
): string | null {
  if (usesRecurrence(recurrence)) {
    const anchor = recurrenceAnchor(startDate, lastCompletedAt, completionDays, timeZone);
    if (!anchor) return null;
    const today = dayKeyInZone(now, timeZone);
    if (today === null) return null;
    const days = recurrenceDays(recurrence, {
      anchorKey: anchor,
      doneKeys: completionDays,
      fromKey: today,
      toKey: addDaysToKey(today, 400) ?? today,
    });
    return days[0] ?? null;
  }
  if (lastCompletedAt) {
    if (!Number.isFinite(intervalDays) || intervalDays <= 0) return null;
    const key = dayKeyInZone(new Date(lastCompletedAt), timeZone);
    if (key === null) return null;
    return addDaysToKey(key, intervalDays);
  }
  if (!startDate) return null;
  return startDate;
}

export function taskDueStatus(
  startDate: string | null | undefined,
  lastCompletedAt: string | null | undefined,
  intervalDays: number,
  now: Date,
  timeZone?: string,
  recurrence?: Recurrence,
  completionDays: readonly string[] = [],
): "due" | "upcoming" {
  const today = dayKeyInZone(now, timeZone);
  if (today === null) return "due";
  if (usesRecurrence(recurrence)) {
    const anchor = recurrenceAnchor(startDate, lastCompletedAt, completionDays, timeZone);
    if (!anchor) return "due";
    if (completionDays.includes(today)) return "upcoming";
    return isScheduledOn(recurrence, today, anchor, completionDays) ? "due" : "upcoming";
  }
  if (!lastCompletedAt) {
    if (!startDate) return "due";
    return startDate <= today ? "due" : "upcoming";
  }
  const dueOn = taskNextDueOn(startDate, lastCompletedAt, intervalDays, timeZone);
  if (!dueOn) return "due";
  return dueOn <= today ? "due" : "upcoming";
}

export type TreatmentScheduleState = "completed" | "up-to-date" | "due" | "missed" | "not-started";

function utcDayKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function treatmentScheduleStatus(
  treatment: {
    status: string;
    startDate: string;
    endDate: string | null;
    slots: readonly string[];
    recurrence?: Recurrence;
  },
  logs: readonly { givenAt: string; slot: string | null; skipped: boolean }[],
  now: Date,
): TreatmentScheduleState {
  if (treatment.status !== "active") return "completed";
  const today = todayUtc(now);
  const started = utcDay(`${treatment.startDate}T00:00:00.000Z`);
  const todays = logs.filter((log) => utcDay(log.givenAt) === today);
  if (logs.some((log) => log.skipped)) return "missed";
  if (started !== null && started > today) return "not-started";
  const todayKey = new Date(today).toISOString().slice(0, 10);
  const recurrence = treatment.recurrence ?? DEFAULT_RECURRENCE;
  const doneKeys = logs
    .filter((log) => !log.skipped)
    .map((log) => utcDayKey(log.givenAt))
    .filter((key): key is string => key !== null);
  if (!isScheduledOn(recurrence, todayKey, treatment.startDate, doneKeys)) return "up-to-date";
  if (treatment.slots.length > 0) {
    return allSlotsDone(treatment.slots as readonly DaySlot[], todays) ? "up-to-date" : "due";
  }
  if (todays.some((log) => !log.skipped)) return "up-to-date";
  return "due";
}

export type AttentionKind = "weight" | "vaccination" | "care" | "follow-up";
export type AttentionSeverity = "watch" | "alert";

export type AttentionBadge = {
  kind: AttentionKind;
  label: string;
  severity: AttentionSeverity;
};

export type AttentionInput = {
  weightAlert?: WeightAssessment | null;
  vaccinations?: { vaccine: string; nextDueAt: string | null }[];
  care?: { kind: string; lastDoneAt: string | null; intervalDays: number }[];
  followUps?: { title: string; followUpAt: string }[];
};

export function needsAttention(input: AttentionInput, now: Date): AttentionBadge[] {
  const badges: AttentionBadge[] = [];

  for (const vaccination of input.vaccinations ?? []) {
    const status = dueStatus(vaccination.nextDueAt, now, 30);
    if (status === "overdue") {
      badges.push({
        kind: "vaccination",
        label: `${vaccination.vaccine} vaccine overdue`,
        severity: "alert",
      });
    } else if (status === "due-soon") {
      badges.push({
        kind: "vaccination",
        label: `${vaccination.vaccine} vaccine due soon`,
        severity: "watch",
      });
    }
  }

  for (const care of input.care ?? []) {
    const status = careDueStatus(care.lastDoneAt, care.intervalDays, now, 7);
    if (status === "overdue") {
      badges.push({ kind: "care", label: `${capitalize(care.kind)} overdue`, severity: "alert" });
    } else if (status === "due-soon") {
      badges.push({ kind: "care", label: `${capitalize(care.kind)} due soon`, severity: "watch" });
    }
  }

  if (input.weightAlert === "alert") {
    badges.push({ kind: "weight", label: "Weight loss alert", severity: "alert" });
  } else if (input.weightAlert === "watch") {
    badges.push({ kind: "weight", label: "Weight watch", severity: "watch" });
  }

  for (const followUp of input.followUps ?? []) {
    if (dueStatus(followUp.followUpAt, now, 0) === "overdue") {
      badges.push({ kind: "follow-up", label: `Follow-up: ${followUp.title}`, severity: "alert" });
    }
  }

  return badges;
}

export function upcomingAppointments<T extends { scheduledAt: string; status: string }>(
  appointments: T[],
  now: Date,
  days: number,
): T[] {
  const limit = now.getTime() + days * 86_400_000;
  return appointments
    .filter((appointment) => appointment.status === "scheduled")
    .filter((appointment) => {
      const time = Date.parse(appointment.scheduledAt);
      return time >= now.getTime() && time <= limit;
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function overdueFollowUps<T extends { followUpAt: string | null; status: string }>(
  appointments: T[],
  now: Date,
): T[] {
  return appointments
    .filter(
      (appointment): appointment is T & { followUpAt: string } =>
        appointment.status === "scheduled" && appointment.followUpAt !== null,
    )
    .filter((appointment) => Date.parse(appointment.followUpAt) < now.getTime())
    .sort((a, b) => a.followUpAt.localeCompare(b.followUpAt));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ageFromDob(dob: string, now: Date): { years: number; months: number } {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return { years: 0, months: 0 };
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  let months = now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function ageLabel(dob: string | null, now: Date = new Date()): string {
  if (!dob) return "Age unknown";
  const { years, months } = ageFromDob(dob, now);
  if (years === 0 && months === 0) return "Under 1 month";
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${months}m`;
}
