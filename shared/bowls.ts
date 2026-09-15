import type { BowlReadingKind } from "./types.ts";

export type BowlReadingInput = {
  id: number;
  readAt: string | Date;
  kind: string;
  weightGrams: number;
};

export type BowlReadingSummary = {
  id: number;
  consumptionGrams: number;
  refillGrams: number;
  periodStart: boolean;
};

export type BowlSummary = {
  readings: BowlReadingSummary[];
  currentWeightGrams: number | null;
  periodStartAt: Date | null;
  periodConsumptionGrams: number;
  periodRefillGrams: number;
  totalConsumptionGrams: number;
  totalRefillGrams: number;
};

export function summarizeBowl(readings: BowlReadingInput[]): BowlSummary {
  const ordered = [...readings].sort((a, b) => {
    const byTime = new Date(a.readAt).getTime() - new Date(b.readAt).getTime();
    return byTime !== 0 ? byTime : a.id - b.id;
  });

  const summaries: BowlReadingSummary[] = [];
  let baseline: number | null = null;
  let periodStartAt: Date | null = null;
  let periodConsumption = 0;
  let periodRefill = 0;
  let totalConsumption = 0;
  let totalRefill = 0;

  for (const reading of ordered) {
    const previous = baseline;
    const periodStart = reading.kind === "start" || reading.kind === "refresh" || previous === null;
    let consumption = 0;
    let refill = 0;
    if (periodStart) {
      periodStartAt = new Date(reading.readAt);
      periodConsumption = 0;
      periodRefill = 0;
    } else if (previous !== null && reading.weightGrams > previous) {
      refill = reading.weightGrams - previous;
    } else if (previous !== null) {
      consumption = previous - reading.weightGrams;
    }
    baseline = reading.weightGrams;
    periodConsumption += consumption;
    periodRefill += refill;
    totalConsumption += consumption;
    totalRefill += refill;
    summaries.push({ id: reading.id, consumptionGrams: consumption, refillGrams: refill, periodStart });
  }

  return {
    readings: summaries,
    currentWeightGrams: baseline,
    periodStartAt,
    periodConsumptionGrams: periodConsumption,
    periodRefillGrams: periodRefill,
    totalConsumptionGrams: totalConsumption,
    totalRefillGrams: totalRefill,
  };
}

export function bowlReadingKindLabel(kind: BowlReadingKind): string {
  if (kind === "start") return "Start";
  if (kind === "refill") return "Top up";
  if (kind === "refresh") return "Refresh";
  return "Weigh-in";
}

export type BowlDailyConsumption = {
  day: string;
  consumptionGrams: number;
};

export type BowlDailySummary = {
  days: BowlDailyConsumption[];
  totalConsumptionGrams: number;
  spanDays: number;
  averageConsumptionGrams: number;
};

export function summarizeBowlByDay(readings: BowlReadingInput[]): BowlDailySummary {
  const ordered = [...readings].sort((a, b) => {
    const byTime = new Date(a.readAt).getTime() - new Date(b.readAt).getTime();
    return byTime !== 0 ? byTime : a.id - b.id;
  });
  const summary = summarizeBowl(ordered);
  const consumptionById = new Map(summary.readings.map((item) => [item.id, item.consumptionGrams]));
  const byDay = new Map<string, number>();
  for (let index = 0; index < ordered.length; index += 1) {
    const consumption = consumptionById.get(ordered[index].id) ?? 0;
    if (consumption <= 0) continue;
    const from = index > 0 ? ordered[index - 1].readAt : ordered[index].readAt;
    distributeConsumption(byDay, from, ordered[index].readAt, consumption);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, consumptionGrams]) => ({ day, consumptionGrams }));
  const totalConsumptionGrams = days.reduce((sum, day) => sum + day.consumptionGrams, 0);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const spanDays =
    first && last
      ? Math.max(
          1,
          Math.round(
            (new Date(last.readAt).getTime() - new Date(first.readAt).getTime()) / 86_400_000,
          ),
        )
      : 0;
  const averageConsumptionGrams =
    spanDays > 0 ? Math.round(totalConsumptionGrams / spanDays) : 0;
  return { days, totalConsumptionGrams, spanDays, averageConsumptionGrams };
}

function distributeConsumption(
  byDay: Map<string, number>,
  from: string | Date,
  to: string | Date,
  total: number,
): void {
  const start = new Date(from);
  const end = new Date(to);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last && keys.length < 3660) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (keys.length === 0) return;
  const base = Math.floor(total / keys.length);
  let remainder = total - base * keys.length;
  for (const key of keys) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    byDay.set(key, (byDay.get(key) ?? 0) + base + extra);
  }
}

function localDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
