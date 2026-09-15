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

export type SlotRange = {
  start: number;
  end: number;
};

export const DAY_SLOT_RANGES: Record<DaySlot, SlotRange> = {
  early_morning: { start: 5 * 60, end: 8 * 60 },
  morning: { start: 8 * 60, end: 12 * 60 },
  afternoon: { start: 12 * 60, end: 17 * 60 },
  evening: { start: 17 * 60, end: 21 * 60 },
  night: { start: 21 * 60, end: 5 * 60 },
};

export type SlotTimeStatus = "on_time" | "early" | "late";

export function slotTimeStatus(slot: DaySlot, at: Date): SlotTimeStatus {
  const { start, end } = DAY_SLOT_RANGES[slot];
  const minutes = at.getHours() * 60 + at.getMinutes();
  if (start < end) {
    if (minutes < start) return "early";
    if (minutes >= end) return "late";
    return "on_time";
  }
  if (minutes >= start || minutes < end) return "on_time";
  const gap = start - end;
  return minutes - end <= gap / 2 ? "late" : "early";
}

export function slotForTime(at: Date): DaySlot {
  const minutes = at.getHours() * 60 + at.getMinutes();
  return (
    DAY_SLOTS.find((slot) => {
      const { start, end } = DAY_SLOT_RANGES[slot];
      return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    }) ?? "night"
  );
}

export function nearestSlot(slots: readonly DaySlot[], at: Date): DaySlot | null {
  if (slots.length === 0) return null;
  const minutes = at.getHours() * 60 + at.getMinutes();
  let best: DaySlot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const { start, end } = DAY_SLOT_RANGES[slot];
    const inside = start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    const distance = inside
      ? 0
      : Math.min(circularMinutes(minutes, start), circularMinutes(minutes, end));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best;
}

function circularMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1440;
  return Math.min(diff, 1440 - diff);
}

export function slotRangeLabel(slot: DaySlot): string {
  const { start, end } = DAY_SLOT_RANGES[slot];
  return `${formatMinutes(start)}–${formatMinutes(end)}`;
}

function formatMinutes(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

export type SlotStatus = {
  slot: DaySlot;
  done: boolean;
  missed: boolean;
  status: SlotTimeStatus | null;
};

export function slotStatus(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null; at?: string | Date; skipped?: boolean }[],
): SlotStatus[] {
  const bySlot = new Map<string, { slot: string | null; at?: string | Date; skipped?: boolean }>();
  for (const log of dayLogs) {
    if (log.slot && !bySlot.has(log.slot)) bySlot.set(log.slot, log);
  }
  return slots.map((slot) => {
    const log = bySlot.get(slot);
    return {
      slot,
      done: log !== undefined,
      missed: log?.skipped === true,
      status: log?.at ? slotTimeStatus(slot, new Date(log.at)) : null,
    };
  });
}

export function allSlotsDone(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null; at?: string | Date; skipped?: boolean }[],
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
