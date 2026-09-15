import { describe, expect, it } from "vitest";
import { DRUG_FORMS } from "../../shared/drugs.ts";
import { DEFAULT_LOOKUPS } from "../../shared/lookups.ts";
import { DRUG_SEED, drugSeedKey } from "../src/lib/drugSeedData.ts";

describe("drug seed data", () => {
  it("has unique names", () => {
    const names = DRUG_SEED.map((drug) => drug.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses route and frequency labels that exist in the default lookups", () => {
    const routeLabels = new Set(DEFAULT_LOOKUPS.route.map((item) => item.label.toLowerCase()));
    const frequencyLabels = new Set(
      DEFAULT_LOOKUPS.frequency.map((item) => item.label.toLowerCase()),
    );
    for (const drug of DRUG_SEED) {
      if (drug.route) expect(routeLabels.has(drug.route.toLowerCase())).toBe(true);
      if (drug.frequency) expect(frequencyLabels.has(drug.frequency.toLowerCase())).toBe(true);
    }
  });

  it("has unique seed keys", () => {
    const keys = DRUG_SEED.map((drug) => drugSeedKey(drug));
    expect(new Set(keys).size).toBe(keys.length);
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

  it("only sets a weight-based dose when it has a concentration", () => {
    for (const drug of DRUG_SEED) {
      if (drug.doseMicrogramsPerKg !== null) {
        expect(drug.concentrationMicrogramsPerUnit).not.toBeNull();
      }
    }
  });

  it("sets a non-negative reorder level", () => {
    for (const drug of DRUG_SEED) {
      expect(Number.isInteger(drug.reorderLevelMilliUnits)).toBe(true);
      expect(drug.reorderLevelMilliUnits).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("drugSeedKey", () => {
  const base = {
    activeIngredient: "meloxicam",
    form: "liquid" as const,
    concentrationMicrogramsPerUnit: 1500,
  };

  it("ignores name casing and whitespace in the ingredient", () => {
    expect(drugSeedKey({ ...base, activeIngredient: " Meloxicam " })).toBe(drugSeedKey(base));
  });

  it("separates different concentrations and forms", () => {
    expect(drugSeedKey({ ...base, concentrationMicrogramsPerUnit: 10000 })).not.toBe(
      drugSeedKey(base),
    );
    expect(drugSeedKey({ ...base, form: "paste" })).not.toBe(drugSeedKey(base));
  });

  it("distinguishes a missing concentration from a numeric one", () => {
    expect(drugSeedKey({ ...base, concentrationMicrogramsPerUnit: null })).not.toBe(
      drugSeedKey(base),
    );
  });
});
