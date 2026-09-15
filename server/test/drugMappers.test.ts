import { describe, expect, it } from "vitest";
import { drugBatchToDto, drugToDto, treatmentToDto } from "../src/api/mappers.ts";
import type { DrugBatchRow, DrugRow, TreatmentRow } from "../src/db/schema.ts";

describe("treatmentToDto", () => {
  it("maps the drug link fields", () => {
    const row: TreatmentRow = {
      id: 3,
      rabbitId: 2,
      medication: "Meloxicam oral suspension (Metacam)",
      dose: "0.667 ml",
      route: "oral",
      frequency: "every 12 hours",
      slots: ["morning", "evening"],
      reason: "pain relief",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      status: "active",
      notes: "",
      drugId: 4,
      doseMilliUnits: 667,
      stockDeductedMilliUnits: 6670,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    expect(treatmentToDto(row)).toEqual({
      id: 3,
      rabbitId: 2,
      medication: "Meloxicam oral suspension (Metacam)",
      dose: "0.667 ml",
      route: "oral",
      frequency: "every 12 hours",
      slots: ["morning", "evening"],
      reason: "pain relief",
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      status: "active",
      notes: "",
      drugId: 4,
      doseMilliUnits: 667,
      stockDeductedMilliUnits: 6670,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("maps unlinked treatments", () => {
    const row: TreatmentRow = {
      id: 4,
      rabbitId: 2,
      medication: "Home remedy",
      dose: "",
      route: "",
      frequency: "",
      slots: [],
      reason: "",
      startDate: "2026-02-01",
      endDate: null,
      status: "completed",
      notes: "",
      drugId: null,
      doseMilliUnits: null,
      stockDeductedMilliUnits: 0,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    };
    const dto = treatmentToDto(row);
    expect(dto.drugId).toBeNull();
    expect(dto.doseMilliUnits).toBeNull();
    expect(dto.stockDeductedMilliUnits).toBe(0);
  });
});

describe("drugBatchToDto", () => {
  it("maps a batch row to a camelCase DTO", () => {
    const row: DrugBatchRow = {
      id: 9,
      drugId: 4,
      quantityMilliUnits: 10000,
      expiryDate: "2027-06-30",
      batch: "LOT-1",
      supplier: "Vet Supplies Ltd",
      notes: "fridge",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    expect(drugBatchToDto(row)).toEqual({
      id: 9,
      drugId: 4,
      quantityMilliUnits: 10000,
      expiryDate: "2027-06-30",
      batch: "LOT-1",
      supplier: "Vet Supplies Ltd",
      notes: "fridge",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });
});

describe("drugToDto", () => {
  it("maps a drug row with its batches", () => {
    const row: DrugRow = {
      id: 4,
      name: "Meloxicam oral suspension (Metacam)",
      activeIngredient: "meloxicam",
      form: "liquid",
      unit: "ml",
      concentrationMicrogramsPerUnit: 1500,
      doseMicrogramsPerKg: 500,
      dosesPerDay: 2,
      route: "oral",
      frequency: "every 12 hours",
      durationDays: null,
      howToUse: "Give with food.",
      warnings: "NSAID.",
      reorderLevelMilliUnits: 5000,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const batch: DrugBatchRow = {
      id: 9,
      drugId: 4,
      quantityMilliUnits: 10000,
      expiryDate: null,
      batch: "",
      supplier: "",
      notes: "",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const dto = drugToDto(row, [batch]);
    expect(dto.id).toBe(4);
    expect(dto.form).toBe("liquid");
    expect(dto.concentrationMicrogramsPerUnit).toBe(1500);
    expect(dto.reorderLevelMilliUnits).toBe(5000);
    expect(dto.batches).toHaveLength(1);
    expect(dto.batches[0].id).toBe(9);
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles drugs with no batches or structured dose", () => {
    const row: DrugRow = {
      id: 5,
      name: "Critical Care recovery food (Oxbow)",
      activeIngredient: "recovery food",
      form: "powder",
      unit: "g",
      concentrationMicrogramsPerUnit: null,
      doseMicrogramsPerKg: null,
      dosesPerDay: 1,
      route: "oral",
      frequency: "as directed",
      durationDays: null,
      howToUse: "",
      warnings: "",
      reorderLevelMilliUnits: 500000,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const dto = drugToDto(row, []);
    expect(dto.concentrationMicrogramsPerUnit).toBeNull();
    expect(dto.doseMicrogramsPerKg).toBeNull();
    expect(dto.batches).toEqual([]);
  });
});
