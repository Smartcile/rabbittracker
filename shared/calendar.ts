export const CALENDAR_REPEATS = ["none", "daily", "weekly", "monthly"] as const;
export type CalendarRepeat = (typeof CALENDAR_REPEATS)[number];

export const CALENDAR_REPEAT_LABELS: Record<CalendarRepeat, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export type RepeatableEntry = {
  startAt: string;
  repeat: string;
  repeatUntil: string | null;
};

export function expandEntryStart(
  entry: RepeatableEntry,
  from: Date,
  to: Date,
  limit = 400,
): Date[] {
  const start = new Date(entry.startAt);
  if (Number.isNaN(start.getTime())) return [];
  const until = entry.repeatUntil ? new Date(`${entry.repeatUntil}T23:59:59.999Z`) : null;
  const repeat = (CALENDAR_REPEATS as readonly string[]).includes(entry.repeat)
    ? (entry.repeat as CalendarRepeat)
    : "none";
  if (repeat === "none") {
    return start >= from && start <= to ? [start] : [];
  }
  const occurrences: Date[] = [];
  let current = new Date(start);
  let guard = 0;
  while (current <= to && guard < limit) {
    if (until && current > until) break;
    if (current >= from) occurrences.push(new Date(current));
    if (repeat === "daily") current.setUTCDate(current.getUTCDate() + 1);
    else if (repeat === "weekly") current.setUTCDate(current.getUTCDate() + 7);
    else current.setUTCMonth(current.getUTCMonth() + 1);
    guard += 1;
  }
  return occurrences;
}
