import { describe, expect, it } from "vitest";
import {
  TREATMENT_SLOT_LABELS,
  TREATMENT_SLOTS,
  nextPendingTreatmentSlot,
  treatmentDayDone,
  treatmentSlotStatus,
} from "./treatments.ts";

describe("treatment slots", () => {
  it("labels every slot", () => {
    for (const slot of TREATMENT_SLOTS) {
      expect(TREATMENT_SLOT_LABELS[slot].length).toBeGreaterThan(0);
    }
  });
});

describe("treatmentSlotStatus", () => {
  it("marks slots that have a matching log", () => {
    const status = treatmentSlotStatus(["morning", "evening"], [
      { slot: "morning" },
      { slot: null },
    ]);
    expect(status).toEqual([
      { slot: "morning", done: true },
      { slot: "evening", done: false },
    ]);
  });

  it("ignores logs without a slot", () => {
    const status = treatmentSlotStatus(["morning"], [{ slot: null }]);
    expect(status[0]?.done).toBe(false);
  });
});

describe("treatmentDayDone", () => {
  it("is done when every configured slot is logged", () => {
    expect(treatmentDayDone(["morning", "evening"], [{ slot: "morning" }])).toBe(false);
    expect(treatmentDayDone(["morning", "evening"], [{ slot: "morning" }, { slot: "evening" }])).toBe(
      true,
    );
  });

  it("falls back to any dose for treatments without slots", () => {
    expect(treatmentDayDone([], [])).toBe(false);
    expect(treatmentDayDone([], [{ slot: null }])).toBe(true);
  });
});

describe("nextPendingTreatmentSlot", () => {
  it("returns the first unlogged slot in order", () => {
    expect(
      nextPendingTreatmentSlot(["early_morning", "morning", "evening"], [{ slot: "early_morning" }]),
    ).toBe("morning");
  });

  it("returns null when every slot is logged", () => {
    expect(
      nextPendingTreatmentSlot(["morning"], [{ slot: "morning" }]),
    ).toBeNull();
  });
});
