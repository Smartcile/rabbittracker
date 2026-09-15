import type { TreatmentSlot } from "./types.ts";

export const TREATMENT_SLOTS = [
  "early_morning",
  "morning",
  "afternoon",
  "evening",
  "night",
] as const satisfies readonly TreatmentSlot[];

export const TREATMENT_SLOT_LABELS: Record<TreatmentSlot, string> = {
  early_morning: "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export const TREATMENT_SLOT_SHORT_LABELS: Record<TreatmentSlot, string> = {
  early_morning: "Early",
  morning: "AM",
  afternoon: "PM",
  evening: "Eve",
  night: "Night",
};

export type TreatmentSlotStatus = {
  slot: TreatmentSlot;
  done: boolean;
};

export function treatmentSlotStatus(
  slots: readonly TreatmentSlot[],
  dayLogs: readonly { slot: string | null }[],
): TreatmentSlotStatus[] {
  const logged = new Set(dayLogs.map((log) => log.slot));
  return slots.map((slot) => ({ slot, done: logged.has(slot) }));
}

export function treatmentDayDone(
  slots: readonly TreatmentSlot[],
  dayLogs: readonly { slot: string | null }[],
): boolean {
  if (slots.length === 0) return dayLogs.length > 0;
  return treatmentSlotStatus(slots, dayLogs).every((entry) => entry.done);
}

export function nextPendingTreatmentSlot(
  slots: readonly TreatmentSlot[],
  dayLogs: readonly { slot: string | null }[],
): TreatmentSlot | null {
  const logged = new Set(dayLogs.map((log) => log.slot));
  return slots.find((slot) => !logged.has(slot)) ?? null;
}
