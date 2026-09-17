export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const RECURRENCE_KINDS = ["daily", "weekdays", "per_week", "interval"] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export type Recurrence = {
  kind: RecurrenceKind;
  days: Weekday[];
  count: number;
  intervalDays: number;
};

export const DEFAULT_RECURRENCE: Recurrence = {
  kind: "daily",
  days: [],
  count: 1,
  intervalDays: 1,
};

const DAY_MS = 86_400_000;
const MAX_DAYS = 400;

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

export function normalizeRecurrence(value: unknown): Recurrence {
  const input = (value ?? {}) as Partial<Record<keyof Recurrence, unknown>>;
  const kind = (RECURRENCE_KINDS as readonly string[]).includes(String(input.kind))
    ? (input.kind as RecurrenceKind)
    : "daily";
  const days = Array.isArray(input.days) ? [...new Set(input.days.filter(isWeekday))] : [];
  const count = Number.isFinite(Number(input.count))
    ? Math.min(7, Math.max(1, Math.floor(Number(input.count))))
    : 1;
  const intervalDays = Number.isFinite(Number(input.intervalDays))
    ? Math.max(1, Math.floor(Number(input.intervalDays)))
    : 1;
  return { kind, days, count, intervalDays };
}

export function recurrenceFromIntervalDays(intervalDays: number): Recurrence {
  const interval = Math.max(1, Math.floor(intervalDays) || 1);
  return interval <= 1
    ? { ...DEFAULT_RECURRENCE }
    : { ...DEFAULT_RECURRENCE, kind: "interval", intervalDays: interval };
}

export function recurrenceIntervalDays(recurrence: Recurrence): number {
  const value = normalizeRecurrence(recurrence);
  return value.kind === "interval" ? value.intervalDays : 1;
}

export function recurrenceLabel(recurrence: Recurrence): string {
  const value = normalizeRecurrence(recurrence);
  if (value.kind === "weekdays") {
    if (value.days.length === 0) return "Every day";
    return value.days.map((day) => WEEKDAY_LABELS[day]).join(", ");
  }
  if (value.kind === "per_week") {
    return value.count === 1 ? "Once a week (any day)" : `${value.count} per week (any days)`;
  }
  if (value.kind === "interval") {
    return value.intervalDays <= 1 ? "Every day" : `Every ${value.intervalDays} days`;
  }
  return "Every day";
}

function dayToMs(key: string): number | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function msToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function weekdayOf(ms: number): Weekday {
  return WEEKDAYS[(new Date(ms).getUTCDay() + 6) % 7];
}

function mondayOf(ms: number): number {
  const weekday = (new Date(ms).getUTCDay() + 6) % 7;
  return ms - weekday * DAY_MS;
}

export type RecurrenceContext = {
  anchorKey: string | null;
  doneKeys?: readonly string[];
  fromKey: string;
  toKey: string;
};

export function recurrenceDays(recurrence: Recurrence, context: RecurrenceContext): string[] {
  const value = normalizeRecurrence(recurrence);
  const from = dayToMs(context.fromKey);
  const to = dayToMs(context.toKey);
  if (from === null || to === null || to < from) return [];
  const anchor = context.anchorKey ? dayToMs(context.anchorKey) : null;

  if (value.kind === "interval") {
    if (anchor === null) return [];
    const step = value.intervalDays * DAY_MS;
    let start = anchor;
    if (start < from) start += Math.ceil((from - start) / step) * step;
    if (to < start) return [];
    const days: string[] = [];
    for (let time = start; time <= to && days.length < MAX_DAYS; time += step) {
      days.push(msToKey(time));
    }
    return days;
  }

  const start = anchor !== null && anchor > from ? anchor : from;
  if (to < start) return [];

  if (value.kind === "weekdays" && value.days.length > 0) {
    const wanted = new Set(value.days);
    const days: string[] = [];
    for (let time = start; time <= to && days.length < MAX_DAYS; time += DAY_MS) {
      if (wanted.has(weekdayOf(time))) days.push(msToKey(time));
    }
    return days;
  }

  if (value.kind === "per_week") {
    const done = new Set(context.doneKeys ?? []);
    const doneMs = [...done]
      .map(dayToMs)
      .filter((ms): ms is number => ms !== null)
      .sort((a, b) => a - b);
    const days: string[] = [];
    for (let time = start; time <= to && days.length < MAX_DAYS; time += DAY_MS) {
      const key = msToKey(time);
      if (done.has(key)) {
        days.push(key);
        continue;
      }
      const weekStart = mondayOf(time);
      const doneBefore = doneMs.filter((ms) => ms >= weekStart && ms < time).length;
      if (doneBefore < value.count) days.push(key);
    }
    return days;
  }

  const days: string[] = [];
  for (let time = start; time <= to && days.length < MAX_DAYS; time += DAY_MS) {
    days.push(msToKey(time));
  }
  return days;
}

export function isScheduledOn(
  recurrence: Recurrence,
  dayKey: string,
  anchorKey: string | null,
  doneKeys: readonly string[] = [],
): boolean {
  return recurrenceDays(recurrence, { anchorKey, doneKeys, fromKey: dayKey, toKey: dayKey }).length > 0;
}
