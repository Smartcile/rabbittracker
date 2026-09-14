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
