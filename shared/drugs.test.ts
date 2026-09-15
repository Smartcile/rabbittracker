import { describe, expect, it } from "vitest";
import {
  courseDays,
  courseTotalMilliUnits,
  doseMilliUnitsForWeight,
  formatDrugAmount,
  formatMgFromMicrograms,
  formatUnitsFromMilliUnits,
  newestBatchId,
  parseScaledAmount,
  planStockDeduction,
  planTreatmentStockChange,
  stockLevel,
  stockTotalMilliUnits,
} from "./drugs.ts";

describe("doseMilliUnitsForWeight", () => {
  it("converts mg/kg dosing and concentration into measured units", () => {
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 500, concentrationMicrogramsPerUnit: 1500 }, 2000),
    ).toBe(667);
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 5000, concentrationMicrogramsPerUnit: 25000 }, 2000),
    ).toBe(400);
  });

  it("returns null when dose, concentration or weight is missing", () => {
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: null, concentrationMicrogramsPerUnit: 1500 }, 2000),
    ).toBeNull();
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 500, concentrationMicrogramsPerUnit: null }, 2000),
    ).toBeNull();
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 500, concentrationMicrogramsPerUnit: 1500 }, null),
    ).toBeNull();
  });

  it("rejects non-positive weights and concentrations", () => {
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 500, concentrationMicrogramsPerUnit: 1500 }, 0),
    ).toBeNull();
    expect(
      doseMilliUnitsForWeight({ doseMicrogramsPerKg: 500, concentrationMicrogramsPerUnit: 0 }, 2000),
    ).toBeNull();
  });
});

describe("formatDrugAmount", () => {
  it("formats milliunits with up to three decimals", () => {
    expect(formatDrugAmount(667, "ml")).toBe("0.667 ml");
    expect(formatDrugAmount(30, "ml")).toBe("0.03 ml");
    expect(formatDrugAmount(1500, "ml")).toBe("1.5 ml");
  });

  it("omits decimals for whole units", () => {
    expect(formatDrugAmount(1000, "ml")).toBe("1 ml");
    expect(formatDrugAmount(30000, "ml")).toBe("30 ml");
  });
});

describe("formatMgFromMicrograms", () => {
  it("converts micrograms to trimmed milligrams", () => {
    expect(formatMgFromMicrograms(1500)).toBe("1.5");
    expect(formatMgFromMicrograms(500)).toBe("0.5");
    expect(formatMgFromMicrograms(2000)).toBe("2");
    expect(formatMgFromMicrograms(null)).toBe("");
  });
});

describe("formatUnitsFromMilliUnits", () => {
  it("converts milliunits to trimmed units", () => {
    expect(formatUnitsFromMilliUnits(5000)).toBe("5");
    expect(formatUnitsFromMilliUnits(1500)).toBe("1.5");
    expect(formatUnitsFromMilliUnits(667)).toBe("0.667");
    expect(formatUnitsFromMilliUnits(null)).toBe("");
  });
});

describe("parseScaledAmount", () => {
  it("scales a positive decimal", () => {
    expect(parseScaledAmount("1.5", 1000)).toBe(1500);
    expect(parseScaledAmount("2", 1000)).toBe(2000);
  });

  it("treats blank as no value", () => {
    expect(parseScaledAmount("  ", 1000)).toBeNull();
  });

  it("rejects zero unless zero is allowed", () => {
    expect(parseScaledAmount("0", 1000)).toBeUndefined();
    expect(parseScaledAmount("0", 1000, true)).toBe(0);
  });

  it("rejects negative and non-numeric values", () => {
    expect(parseScaledAmount("-1", 1000)).toBeUndefined();
    expect(parseScaledAmount("-1", 1000, true)).toBeUndefined();
    expect(parseScaledAmount("abc", 1000)).toBeUndefined();
  });
});

describe("courseDays", () => {
  it("counts inclusive days between start and end", () => {
    expect(courseDays("2026-01-01", "2026-01-01", null)).toBe(1);
    expect(courseDays("2026-01-01", "2026-01-05", null)).toBe(5);
  });

  it("falls back to the typical duration when there is no end date", () => {
    expect(courseDays("2026-01-01", null, 7)).toBe(7);
    expect(courseDays("2026-01-01", null, null)).toBe(1);
  });

  it("never returns less than one day", () => {
    expect(courseDays("2026-01-05", "2026-01-01", null)).toBe(1);
  });
});

describe("courseTotalMilliUnits", () => {
  it("multiplies dose, doses per day and course length", () => {
    expect(courseTotalMilliUnits(667, 2, "2026-01-01", "2026-01-05", null)).toBe(6670);
  });

  it("uses the typical duration when no end date is set", () => {
    expect(courseTotalMilliUnits(1000, 1, "2026-01-01", null, 7)).toBe(7000);
    expect(courseTotalMilliUnits(1000, 1, "2026-01-01", null, null)).toBe(1000);
  });

  it("treats invalid doses per day as once daily", () => {
    expect(courseTotalMilliUnits(500, 0, "2026-01-01", "2026-01-02", null)).toBe(1000);
  });
});

describe("stockTotalMilliUnits", () => {
  it("sums batch quantities", () => {
    expect(
      stockTotalMilliUnits([
        { id: 1, quantityMilliUnits: 5000, expiryDate: null },
        { id: 2, quantityMilliUnits: 2500, expiryDate: "2026-06-01" },
      ]),
    ).toBe(7500);
  });

  it("ignores negative quantities", () => {
    expect(stockTotalMilliUnits([{ id: 1, quantityMilliUnits: -100, expiryDate: null }])).toBe(0);
  });
});

describe("stockLevel", () => {
  it("reports out, low and ok", () => {
    expect(stockLevel(0, 1000)).toBe("out");
    expect(stockLevel(1000, 1000)).toBe("low");
    expect(stockLevel(1001, 1000)).toBe("ok");
    expect(stockLevel(500, 0)).toBe("ok");
  });
});

describe("planStockDeduction", () => {
  it("deducts from the earliest expiry first", () => {
    const plan = planStockDeduction(
      [
        { id: 1, quantityMilliUnits: 500, expiryDate: "2026-01-01" },
        { id: 2, quantityMilliUnits: 1000, expiryDate: "2026-02-01" },
        { id: 3, quantityMilliUnits: 2000, expiryDate: null },
      ],
      1200,
    );
    expect(plan.changes).toEqual([
      { id: 1, quantityMilliUnits: 0 },
      { id: 2, quantityMilliUnits: 300 },
    ]);
    expect(plan.shortfall).toBe(0);
  });

  it("deducts batches without an expiry last", () => {
    const plan = planStockDeduction(
      [
        { id: 1, quantityMilliUnits: 1000, expiryDate: null },
        { id: 2, quantityMilliUnits: 1000, expiryDate: "2026-01-01" },
      ],
      1000,
    );
    expect(plan.changes).toEqual([{ id: 2, quantityMilliUnits: 0 }]);
  });

  it("reports a shortfall when stock runs out", () => {
    const plan = planStockDeduction(
      [
        { id: 1, quantityMilliUnits: 500, expiryDate: "2026-01-01" },
        { id: 2, quantityMilliUnits: 1000, expiryDate: "2026-02-01" },
      ],
      2000,
    );
    expect(plan.changes).toEqual([
      { id: 1, quantityMilliUnits: 0 },
      { id: 2, quantityMilliUnits: 0 },
    ]);
    expect(plan.shortfall).toBe(500);
  });

  it("does nothing for zero or negative amounts", () => {
    const batches = [{ id: 1, quantityMilliUnits: 500, expiryDate: null }];
    expect(planStockDeduction(batches, 0)).toEqual({ changes: [], shortfall: 0 });
    expect(planStockDeduction(batches, -5)).toEqual({ changes: [], shortfall: 0 });
  });

  it("skips empty batches", () => {
    const plan = planStockDeduction(
      [
        { id: 1, quantityMilliUnits: 0, expiryDate: "2026-01-01" },
        { id: 2, quantityMilliUnits: 500, expiryDate: "2026-02-01" },
      ],
      500,
    );
    expect(plan.changes).toEqual([{ id: 2, quantityMilliUnits: 0 }]);
  });
});

describe("newestBatchId", () => {
  it("returns the highest id", () => {
    expect(newestBatchId([{ id: 3 }, { id: 7 }, { id: 5 }])).toBe(7);
  });

  it("returns null when there are no batches", () => {
    expect(newestBatchId([])).toBeNull();
  });
});

describe("planTreatmentStockChange", () => {
  it("deducts the full course when linking a drug for the first time", () => {
    expect(
      planTreatmentStockChange(
        { drugId: null, deductedMilliUnits: 0 },
        { drugId: 4, neededMilliUnits: 6670 },
      ),
    ).toEqual({
      restore: null,
      deduct: { drugId: 4, amountMilliUnits: 6670 },
      targetDeductedMilliUnits: 6670,
    });
  });

  it("restores everything when the drug link is cleared", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: 6670 },
        { drugId: null, neededMilliUnits: 0 },
      ),
    ).toEqual({
      restore: { drugId: 4, amountMilliUnits: 6670 },
      deduct: null,
      targetDeductedMilliUnits: 0,
    });
  });

  it("restores the old drug and deducts from the new one when switching", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: 6670 },
        { drugId: 9, neededMilliUnits: 1000 },
      ),
    ).toEqual({
      restore: { drugId: 4, amountMilliUnits: 6670 },
      deduct: { drugId: 9, amountMilliUnits: 1000 },
      targetDeductedMilliUnits: 1000,
    });
  });

  it("deducts only the difference when the course grows", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: 4002 },
        { drugId: 4, neededMilliUnits: 6670 },
      ),
    ).toEqual({
      restore: null,
      deduct: { drugId: 4, amountMilliUnits: 2668 },
      targetDeductedMilliUnits: 6670,
    });
  });

  it("restores the difference when the course shrinks", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: 6670 },
        { drugId: 4, neededMilliUnits: 4002 },
      ),
    ).toEqual({
      restore: { drugId: 4, amountMilliUnits: 2668 },
      deduct: null,
      targetDeductedMilliUnits: 4002,
    });
  });

  it("does nothing when the course is unchanged", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: 6670 },
        { drugId: 4, neededMilliUnits: 6670 },
      ),
    ).toEqual({ restore: null, deduct: null, targetDeductedMilliUnits: 6670 });
  });

  it("does nothing when there is nothing to link or restore", () => {
    expect(
      planTreatmentStockChange(
        { drugId: null, deductedMilliUnits: 0 },
        { drugId: null, neededMilliUnits: 0 },
      ),
    ).toEqual({ restore: null, deduct: null, targetDeductedMilliUnits: 0 });
  });

  it("ignores a negative carried amount", () => {
    expect(
      planTreatmentStockChange(
        { drugId: 4, deductedMilliUnits: -100 },
        { drugId: 4, neededMilliUnits: 500 },
      ),
    ).toEqual({
      restore: null,
      deduct: { drugId: 4, amountMilliUnits: 500 },
      targetDeductedMilliUnits: 500,
    });
  });
});
