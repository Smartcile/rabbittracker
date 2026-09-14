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
  if (kind === "refill") return "Refill";
  if (kind === "refresh") return "Refresh";
  return "Weigh-in";
}
