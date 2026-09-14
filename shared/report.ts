import { DAILY_CHECK_KEY_PREFIX } from "./checklist.ts";
import { formatLogNumber } from "./checkLogs.ts";

export type ReportPreset = "day" | "week" | "month" | "all" | "custom";

export type ReportRange = {
  from: Date | null;
  to: Date | null;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveReportRange(
  preset: ReportPreset,
  now: Date,
  customFrom = "",
  customTo = "",
): ReportRange {
  const today = startOfDay(now);
  switch (preset) {
    case "day":
      return { from: today, to: endOfDay(now) };
    case "week": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case "month": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now) };
    }
    case "all":
      return { from: null, to: null };
    case "custom": {
      let from = parseDateInput(customFrom);
      let to = parseDateInput(customTo);
      if (from && to && from > to) [from, to] = [to, from];
      return { from: from ? startOfDay(from) : null, to: to ? endOfDay(to) : null };
    }
  }
}

export function isWithinRange(value: string | null | undefined, range: ReportRange): boolean {
  if (range.from === null && range.to === null) return value != null && value !== "";
  if (!value) return false;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  if (range.from !== null && time < range.from.getTime()) return false;
  if (range.to !== null && time > range.to.getTime()) return false;
  return true;
}

export function localDateValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateWithinRange(value: string | null | undefined, range: ReportRange): boolean {
  if (range.from === null && range.to === null) return value != null && value !== "";
  if (!value) return false;
  if (range.from !== null && value < localDateValue(range.from)) return false;
  if (range.to !== null && value > localDateValue(range.to)) return false;
  return true;
}

export function dateRangesOverlap(
  start: string,
  end: string | null,
  range: ReportRange,
  now: Date,
): boolean {
  if (range.from === null && range.to === null) return true;
  const effectiveEnd = end ?? localDateValue(now);
  if (range.from !== null && effectiveEnd < localDateValue(range.from)) return false;
  if (range.to !== null && start > localDateValue(range.to)) return false;
  return true;
}

export type ReportChecklistSection = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type ReportDailyType = {
  key: string;
  label: string;
  unit: string;
};

export type ReportChecklistAnswer = {
  values: string[];
  other: string;
  numberMilli?: number | null;
  text?: string;
};

export function checklistAnswerLines(
  answers: Record<string, ReportChecklistAnswer>,
  sections: ReportChecklistSection[],
  dailyTypes: ReportDailyType[],
): string[] {
  const lines: string[] = [];
  const covered = new Set<string>();
  for (const section of sections) {
    const answer = answers[section.key];
    if (!answer) continue;
    covered.add(section.key);
    const parts = answer.values.map(
      (value) => section.options.find((option) => option.value === value)?.label ?? value,
    );
    if (answer.other) parts.push(`Other: ${answer.other}`);
    if (parts.length > 0) lines.push(`${section.label}: ${parts.join(", ")}`);
  }
  const typeByKey = new Map(dailyTypes.map((type) => [type.key, type]));
  for (const [key, answer] of Object.entries(answers)) {
    if (covered.has(key)) continue;
    const isDaily = key.startsWith(DAILY_CHECK_KEY_PREFIX);
    const daily = isDaily ? typeByKey.get(key.slice(DAILY_CHECK_KEY_PREFIX.length)) : undefined;
    const label = daily?.label ?? (isDaily ? key.slice(DAILY_CHECK_KEY_PREFIX.length) : key);
    const parts = [...answer.values];
    if (answer.numberMilli != null) parts.push(formatLogNumber(answer.numberMilli, daily?.unit ?? ""));
    if (answer.text) parts.push(answer.text);
    if (answer.other) parts.push(`Other: ${answer.other}`);
    if (parts.length > 0) lines.push(`${label}: ${parts.join(", ")}`);
  }
  return lines;
}
