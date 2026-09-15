export type DrugForm = "liquid" | "tablet" | "paste" | "powder" | "injection" | "other";

export const DRUG_FORMS: DrugForm[] = ["liquid", "tablet", "paste", "powder", "injection", "other"];

export type DrugFormLabel = {
  value: DrugForm;
  label: string;
  defaultUnit: string;
};

export const DRUG_FORM_OPTIONS: DrugFormLabel[] = [
  { value: "liquid", label: "Liquid", defaultUnit: "ml" },
  { value: "tablet", label: "Tablet", defaultUnit: "tablet" },
  { value: "paste", label: "Paste", defaultUnit: "ml" },
  { value: "powder", label: "Powder", defaultUnit: "g" },
  { value: "injection", label: "Injection", defaultUnit: "ml" },
  { value: "other", label: "Other", defaultUnit: "dose" },
];

export type DoseInput = {
  doseMicrogramsPerKg: number | null;
  concentrationMicrogramsPerUnit: number | null;
};

export function doseMilliUnitsForWeight(drug: DoseInput, weightGrams: number | null): number | null {
  if (drug.doseMicrogramsPerKg === null || drug.concentrationMicrogramsPerUnit === null) return null;
  if (drug.doseMicrogramsPerKg <= 0 || drug.concentrationMicrogramsPerUnit <= 0) return null;
  if (weightGrams === null || !Number.isFinite(weightGrams) || weightGrams <= 0) return null;
  return Math.round((drug.doseMicrogramsPerKg * weightGrams) / drug.concentrationMicrogramsPerUnit);
}

export function formatDrugAmount(milliUnits: number, unit: string): string {
  const value = milliUnits / 1000;
  const text = Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} ${unit}`;
}

export function formatMgFromMicrograms(micrograms: number | null | undefined): string {
  if (micrograms === null || micrograms === undefined) return "";
  const mg = micrograms / 1000;
  return Number.isInteger(mg) ? String(mg) : String(Number(mg.toFixed(3)));
}

export function formatUnitsFromMilliUnits(milliUnits: number | null | undefined): string {
  if (milliUnits === null || milliUnits === undefined) return "";
  const units = milliUnits / 1000;
  return Number.isInteger(units) ? String(units) : String(Number(units.toFixed(3)));
}

export function parseScaledAmount(
  value: string,
  scale: number,
  allowZero = false,
): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) return undefined;
  return Math.round(number * scale);
}

function utcDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function courseDays(
  startDate: string,
  endDate: string | null | undefined,
  defaultDurationDays: number | null | undefined,
): number {
  const start = utcDay(startDate);
  const end = endDate ? utcDay(endDate) : null;
  if (start !== null && end !== null) {
    const days = Math.round((end - start) / 86_400_000) + 1;
    return days > 0 ? days : 1;
  }
  if (defaultDurationDays !== null && defaultDurationDays !== undefined && defaultDurationDays > 0) {
    return Math.floor(defaultDurationDays);
  }
  return 1;
}

export function courseTotalMilliUnits(
  doseMilliUnitsPerDose: number,
  dosesPerDay: number,
  startDate: string,
  endDate: string | null | undefined,
  defaultDurationDays: number | null | undefined,
): number {
  const perDay = Number.isFinite(dosesPerDay) && dosesPerDay > 0 ? Math.floor(dosesPerDay) : 1;
  return Math.max(0, Math.round(doseMilliUnitsPerDose)) * perDay * courseDays(startDate, endDate, defaultDurationDays);
}

export type StockBatchLike = {
  id: number;
  quantityMilliUnits: number;
  expiryDate: string | null;
};

export function stockTotalMilliUnits(batches: StockBatchLike[]): number {
  return batches.reduce((sum, batch) => sum + Math.max(0, batch.quantityMilliUnits), 0);
}

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(totalMilliUnits: number, reorderLevelMilliUnits: number): StockLevel {
  if (totalMilliUnits <= 0) return "out";
  if (reorderLevelMilliUnits > 0 && totalMilliUnits <= reorderLevelMilliUnits) return "low";
  return "ok";
}

export type StockDeduction = {
  changes: { id: number; quantityMilliUnits: number }[];
  shortfall: number;
};

export function planStockDeduction(batches: StockBatchLike[], amountMilliUnits: number): StockDeduction {
  if (!Number.isFinite(amountMilliUnits) || amountMilliUnits <= 0) {
    return { changes: [], shortfall: 0 };
  }
  const ordered = [...batches].sort((a, b) => {
    if (a.expiryDate === null && b.expiryDate !== null) return 1;
    if (a.expiryDate !== null && b.expiryDate === null) return -1;
    if (a.expiryDate !== b.expiryDate) return (a.expiryDate ?? "").localeCompare(b.expiryDate ?? "");
    return a.id - b.id;
  });
  let remaining = Math.round(amountMilliUnits);
  const changes: { id: number; quantityMilliUnits: number }[] = [];
  for (const batch of ordered) {
    if (remaining <= 0) break;
    if (batch.quantityMilliUnits <= 0) continue;
    const take = Math.min(remaining, batch.quantityMilliUnits);
    changes.push({ id: batch.id, quantityMilliUnits: batch.quantityMilliUnits - take });
    remaining -= take;
  }
  return { changes, shortfall: remaining };
}

export function newestBatchId(batches: { id: number }[]): number | null {
  if (batches.length === 0) return null;
  return batches.reduce((max, batch) => (batch.id > max ? batch.id : max), batches[0].id);
}

export type TreatmentStockState = {
  drugId: number | null;
  deductedMilliUnits: number;
};

export type TreatmentStockPlan = {
  restore: { drugId: number; amountMilliUnits: number } | null;
  deduct: { drugId: number; amountMilliUnits: number } | null;
  targetDeductedMilliUnits: number;
};

export function planTreatmentStockChange(
  existing: TreatmentStockState,
  next: { drugId: number | null; neededMilliUnits: number },
): TreatmentStockPlan {
  const carried =
    existing.drugId !== null ? Math.max(0, Math.round(existing.deductedMilliUnits)) : 0;
  const needed = Math.max(0, Math.round(next.neededMilliUnits));
  const restoreExisting =
    carried > 0 && existing.drugId !== null
      ? { drugId: existing.drugId, amountMilliUnits: carried }
      : null;

  if (next.drugId === null) {
    return { restore: restoreExisting, deduct: null, targetDeductedMilliUnits: 0 };
  }
  if (existing.drugId !== next.drugId) {
    return {
      restore: restoreExisting,
      deduct: needed > 0 ? { drugId: next.drugId, amountMilliUnits: needed } : null,
      targetDeductedMilliUnits: needed,
    };
  }
  if (needed > carried) {
    return {
      restore: null,
      deduct: { drugId: next.drugId, amountMilliUnits: needed - carried },
      targetDeductedMilliUnits: needed,
    };
  }
  if (needed < carried) {
    return {
      restore: { drugId: next.drugId, amountMilliUnits: carried - needed },
      deduct: null,
      targetDeductedMilliUnits: needed,
    };
  }
  return { restore: null, deduct: null, targetDeductedMilliUnits: carried };
}
