export type DaySlot = "early_morning" | "morning" | "afternoon" | "evening" | "night";

export const DAY_SLOTS = [
  "early_morning",
  "morning",
  "afternoon",
  "evening",
  "night",
] as const satisfies readonly DaySlot[];

export const DAY_SLOT_LABELS: Record<DaySlot, string> = {
  early_morning: "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export const DAY_SLOT_SHORT_LABELS: Record<DaySlot, string> = {
  early_morning: "Early",
  morning: "AM",
  afternoon: "PM",
  evening: "Eve",
  night: "Night",
};

export type SlotStatus = {
  slot: DaySlot;
  done: boolean;
};

export function slotStatus(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null }[],
): SlotStatus[] {
  const logged = new Set(dayLogs.map((log) => log.slot));
  return slots.map((slot) => ({ slot, done: logged.has(slot) }));
}

export function allSlotsDone(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null }[],
): boolean {
  if (slots.length === 0) return dayLogs.length > 0;
  return slotStatus(slots, dayLogs).every((entry) => entry.done);
}

export function nextPendingSlot(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null }[],
): DaySlot | null {
  const logged = new Set(dayLogs.map((log) => log.slot));
  return slots.find((slot) => !logged.has(slot)) ?? null;
}
