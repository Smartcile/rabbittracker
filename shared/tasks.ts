import type { TaskSlot } from "./types.ts";

export const TASK_SLOTS = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const satisfies readonly TaskSlot[];

export const TASK_SLOT_LABELS: Record<TaskSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime",
};

export function taskScheduleDays(
  task: { startDate: string | null; intervalDays: number },
  completionDays: readonly string[],
  fromKey: string,
  toKey: string,
  fallbackStartKey?: string | null,
): string[] {
  const interval = Math.max(1, Math.floor(task.intervalDays));
  const anchorKey =
    task.startDate ?? [...completionDays].sort()[0] ?? fallbackStartKey ?? null;
  if (!anchorKey) return [];
  const anchor = dayToMs(anchorKey);
  const from = dayToMs(fromKey);
  const to = dayToMs(toKey);
  if (anchor === null || from === null || to === null || to < anchor) return [];
  let start = anchor;
  if (start < from) {
    const steps = Math.ceil((from - start) / (interval * 86_400_000));
    start += steps * interval * 86_400_000;
  }
  const days: string[] = [];
  for (let time = start; time <= to && days.length < 400; time += interval * 86_400_000) {
    days.push(msToKey(time));
  }
  return days;
}

function dayToMs(key: string): number | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function msToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
