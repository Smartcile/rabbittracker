import { describe, expect, it } from "vitest";
import {
  drugBatchCreateSchema,
  drugBatchUpdateSchema,
  drugCreateSchema,
  drugUpdateSchema,
  treatmentCreateSchema,
  treatmentUpdateSchema,
} from "../src/lib/validation.ts";

describe("drugCreateSchema", () => {
  it("applies defaults for a minimal drug", () => {
    const result = drugCreateSchema.parse({ name: "Meloxicam" });
    expect(result.form).toBe("liquid");
    expect(result.unit).toBe("ml");
    expect(result.dosesPerDay).toBe(1);
    expect(result.reorderLevelMilliUnits).toBe(0);
    expect(result.concentrationMicrogramsPerUnit).toBeUndefined();
  });

  it("accepts structured dosing", () => {
    const result = drugCreateSchema.parse({
      name: "Meloxicam",
      concentrationMicrogramsPerUnit: 1500,
      doseMicrogramsPerKg: 500,
      dosesPerDay: 2,
    });
    expect(result.concentrationMicrogramsPerUnit).toBe(1500);
    expect(result.doseMicrogramsPerKg).toBe(500);
    expect(result.dosesPerDay).toBe(2);
  });

  it("rejects empty names", () => {
    expect(drugCreateSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("rejects non-positive concentrations and doses", () => {
    expect(
      drugCreateSchema.safeParse({ name: "X", concentrationMicrogramsPerUnit: 0 }).success,
    ).toBe(false);
    expect(drugCreateSchema.safeParse({ name: "X", doseMicrogramsPerKg: -1 }).success).toBe(false);
  });

  it("rejects invalid forms and zero doses per day", () => {
    expect(drugCreateSchema.safeParse({ name: "X", form: "gas" }).success).toBe(false);
    expect(drugCreateSchema.safeParse({ name: "X", dosesPerDay: 0 }).success).toBe(false);
  });
});

describe("drugUpdateSchema", () => {
  it("requires at least one change", () => {
    expect(drugUpdateSchema.safeParse({}).success).toBe(false);
    expect(drugUpdateSchema.safeParse({ name: "New name" }).success).toBe(true);
  });

  it("allows clearing concentration and dose with null", () => {
    const result = drugUpdateSchema.parse({ concentrationMicrogramsPerUnit: null, doseMicrogramsPerKg: null });
    expect(result.concentrationMicrogramsPerUnit).toBeNull();
    expect(result.doseMicrogramsPerKg).toBeNull();
  });
});

describe("drugBatch schemas", () => {
  it("defaults a batch to an empty quantity", () => {
    const result = drugBatchCreateSchema.parse({});
    expect(result.quantityMilliUnits).toBe(0);
    expect(result.batch).toBe("");
  });

  it("accepts an expiry date and rejects a malformed one", () => {
    expect(drugBatchCreateSchema.safeParse({ expiryDate: "2026-12-31" }).success).toBe(true);
    expect(drugBatchCreateSchema.safeParse({ expiryDate: "31/12/2026" }).success).toBe(false);
  });

  it("requires at least one change on batch update", () => {
    expect(drugBatchUpdateSchema.safeParse({}).success).toBe(false);
    expect(drugBatchUpdateSchema.safeParse({ quantityMilliUnits: 1000 }).success).toBe(true);
  });
});

describe("treatment drug links", () => {
  it("accepts a drug link and dose on create", () => {
    const result = treatmentCreateSchema.parse({
      rabbitId: 1,
      medication: "Meloxicam",
      startDate: "2026-01-01",
      drugId: 2,
      doseMilliUnits: 667,
    });
    expect(result.drugId).toBe(2);
    expect(result.doseMilliUnits).toBe(667);
  });

  it("allows clearing the drug link on update", () => {
    const result = treatmentUpdateSchema.parse({ drugId: null });
    expect(result.drugId).toBeNull();
  });

  it("rejects negative dose amounts", () => {
    expect(
      treatmentCreateSchema.safeParse({
        rabbitId: 1,
        medication: "X",
        startDate: "2026-01-01",
        doseMilliUnits: -1,
      }).success,
    ).toBe(false);
  });
});
