import type { Recurrence } from "./recurrence.ts";
import { recurrenceDays, recurrenceFromIntervalDays } from "./recurrence.ts";
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

export function taskSlotForTime(at: Date): TaskSlot {
  const hour = at.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "anytime";
}

export function taskScheduleDays(
  task: { startDate: string | null; intervalDays: number; recurrence?: Recurrence },
  completionDays: readonly string[],
  fromKey: string,
  toKey: string,
  fallbackStartKey?: string | null,
): string[] {
  const anchorKey = task.startDate ?? [...completionDays].sort()[0] ?? fallbackStartKey ?? null;
  if (!anchorKey) return [];
  const recurrence = task.recurrence ?? recurrenceFromIntervalDays(task.intervalDays);
  return recurrenceDays(recurrence, { anchorKey, doneKeys: completionDays, fromKey, toKey });
}
