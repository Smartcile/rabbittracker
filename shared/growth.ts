export type WeightRange = {
  minGrams: number;
  maxGrams: number;
};

export type NormLevel = "ok" | "watch" | "alert";

const GROWTH_POINTS: { days: number; ratio: number }[] = [
  { days: 0, ratio: 0.06 },
  { days: 14, ratio: 0.14 },
  { days: 30, ratio: 0.22 },
  { days: 60, ratio: 0.42 },
  { days: 90, ratio: 0.58 },
  { days: 120, ratio: 0.72 },
  { days: 150, ratio: 0.82 },
  { days: 180, ratio: 0.9 },
  { days: 210, ratio: 0.95 },
  { days: 240, ratio: 1 },
];

export function growthRatio(ageDays: number): number {
  if (ageDays <= GROWTH_POINTS[0].days) return GROWTH_POINTS[0].ratio;
  for (let index = 1; index < GROWTH_POINTS.length; index += 1) {
    const previous = GROWTH_POINTS[index - 1];
    const next = GROWTH_POINTS[index];
    if (ageDays <= next.days) {
      const span = next.days - previous.days;
      const progress = span === 0 ? 1 : (ageDays - previous.days) / span;
      return previous.ratio + (next.ratio - previous.ratio) * progress;
    }
  }
  return 1;
}

export function expectedWeightRange(adult: WeightRange, ageDays: number): WeightRange {
  const ratio = growthRatio(ageDays);
  return {
    minGrams: Math.round(adult.minGrams * ratio),
    maxGrams: Math.round(adult.maxGrams * ratio),
  };
}

export function ageInDays(dob: string, at: Date): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return 0;
  return Math.max(0, Math.floor((at.getTime() - birth.getTime()) / 86_400_000));
}

export function rangeLevel(value: number, range: WeightRange): NormLevel {
  if (value >= range.minGrams && value <= range.maxGrams) return "ok";
  const span = Math.max(1, range.maxGrams - range.minGrams);
  const distance = value < range.minGrams ? range.minGrams - value : value - range.maxGrams;
  return distance <= span * 0.25 ? "watch" : "alert";
}

export type StagePhase = "done" | "current" | "overdue" | "upcoming";

export function stagePhase(
  stage: { startDays: number; endDays: number },
  ageDays: number,
  completed: boolean,
): StagePhase {
  if (completed) return "done";
  if (ageDays < stage.startDays) return "upcoming";
  if (ageDays <= stage.endDays) return "current";
  return "overdue";
}
