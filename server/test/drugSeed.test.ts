import { describe, expect, it } from "vitest";
import { DRUG_FORMS } from "../../shared/drugs.ts";
import { DRUG_SEED } from "../src/lib/drugSeedData.ts";

describe("drug seed data", () => {
  it("has unique names", () => {
    const names = DRUG_SEED.map((drug) => drug.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses valid forms, units and dose frequency", () => {
    for (const drug of DRUG_SEED) {
      expect(DRUG_FORMS).toContain(drug.form);
      expect(drug.unit.length).toBeGreaterThan(0);
      expect(Number.isInteger(drug.dosesPerDay)).toBe(true);
      expect(drug.dosesPerDay).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses whole-number microgram dosing", () => {
    for (const drug of DRUG_SEED) {
      if (drug.doseMicrogramsPerKg !== null) {
        expect(Number.isInteger(drug.doseMicrogramsPerKg)).toBe(true);
        expect(drug.doseMicrogramsPerKg).toBeGreaterThan(0);
      }
      if (drug.concentrationMicrogramsPerUnit !== null) {
        expect(Number.isInteger(drug.concentrationMicrogramsPerUnit)).toBe(true);
        expect(drug.concentrationMicrogramsPerUnit).toBeGreaterThan(0);
      }
    }
  });

  it("has a weight-based dose only when it has a concentration", () => {
    for (const drug of DRUG_SEED) {
      expect(drug.doseMicrogramsPerKg !== null).toBe(
        drug.concentrationMicrogramsPerUnit !== null,
      );
    }
  });

  it("sets a non-negative reorder level", () => {
    for (const drug of DRUG_SEED) {
      expect(Number.isInteger(drug.reorderLevelMilliUnits)).toBe(true);
      expect(drug.reorderLevelMilliUnits).toBeGreaterThanOrEqual(0);
    }
  });
});
