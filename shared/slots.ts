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

export function sameTimeOfDay(a: Date, b: Date): boolean {
  return a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
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
  offSchedule: boolean;
};

function nearestScheduledSlot(slots: readonly DaySlot[], extra: DaySlot): DaySlot | null {
  const target = DAY_SLOTS.indexOf(extra);
  let best: DaySlot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestForward = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const index = DAY_SLOTS.indexOf(slot);
    const forward = (index - target + DAY_SLOTS.length) % DAY_SLOTS.length;
    const distance = Math.min(forward, DAY_SLOTS.length - forward);
    if (distance < bestDistance || (distance === bestDistance && forward < bestForward)) {
      best = slot;
      bestDistance = distance;
      bestForward = forward;
    }
  }
  return best;
}

export function slotStatus(
  slots: readonly DaySlot[],
  dayLogs: readonly { slot: string | null; at?: string | Date; skipped?: boolean }[],
): SlotStatus[] {
  const bySlot = new Map<string, { slot: string | null; at?: string | Date; skipped?: boolean }>();
  for (const log of dayLogs) {
    if (log.slot && !bySlot.has(log.slot)) bySlot.set(log.slot, log);
  }
  const scheduled = new Set<string>(slots);
  const extras = [...bySlot.keys()].filter((slot) => !scheduled.has(slot)) as DaySlot[];
  const claimed = new Set<DaySlot>();
  const entries: SlotStatus[] = slots.map((slot) => {
    const log = bySlot.get(slot);
    if (log) {
      claimed.add(slot);
      return {
        slot,
        done: true,
        missed: log.skipped === true,
        status: log.at ? slotTimeStatus(slot, new Date(log.at)) : null,
        offSchedule: false,
      };
    }
    const substitute = extras.find(
      (extra) => !claimed.has(extra) && nearestScheduledSlot(slots, extra) === slot,
    );
    if (substitute) {
      claimed.add(substitute);
      const extraLog = bySlot.get(substitute)!;
      return {
        slot: substitute,
        done: true,
        missed: extraLog.skipped === true,
        status: extraLog.at ? slotTimeStatus(substitute, new Date(extraLog.at)) : null,
        offSchedule: true,
      };
    }
    return { slot, done: false, missed: false, status: null, offSchedule: false };
  });
  for (const extra of extras) {
    if (claimed.has(extra)) continue;
    const log = bySlot.get(extra)!;
    entries.push({
      slot: extra,
      done: true,
      missed: log.skipped === true,
      status: log.at ? slotTimeStatus(extra, new Date(log.at)) : null,
      offSchedule: true,
    });
  }
  return entries;
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
