import { describe, expect, it } from "vitest";
import {
  DAY_SLOT_LABELS,
  DAY_SLOTS,
  allSlotsDone,
  nextPendingSlot,
  slotStatus,
} from "./slots.ts";

describe("day slots", () => {
  it("labels every slot", () => {
    for (const slot of DAY_SLOTS) {
      expect(DAY_SLOT_LABELS[slot].length).toBeGreaterThan(0);
    }
  });
});

describe("slotStatus", () => {
  it("marks slots that have a matching log", () => {
    const status = slotStatus(["morning", "evening"], [{ slot: "morning" }, { slot: null }]);
    expect(status).toEqual([
      { slot: "morning", done: true },
      { slot: "evening", done: false },
    ]);
  });

  it("ignores logs without a slot", () => {
    const status = slotStatus(["morning"], [{ slot: null }]);
    expect(status[0]?.done).toBe(false);
  });
});

describe("allSlotsDone", () => {
  it("is done when every configured slot is logged", () => {
    expect(allSlotsDone(["morning", "evening"], [{ slot: "morning" }])).toBe(false);
    expect(allSlotsDone(["morning", "evening"], [{ slot: "morning" }, { slot: "evening" }])).toBe(
      true,
    );
  });

  it("falls back to any log for entries without slots", () => {
    expect(allSlotsDone([], [])).toBe(false);
    expect(allSlotsDone([], [{ slot: null }])).toBe(true);
  });
});

describe("nextPendingSlot", () => {
  it("returns the first unlogged slot in order", () => {
    expect(nextPendingSlot(["early_morning", "morning", "evening"], [{ slot: "early_morning" }])).toBe(
      "morning",
    );
  });

  it("returns null when every slot is logged", () => {
    expect(nextPendingSlot(["morning"], [{ slot: "morning" }])).toBeNull();
  });
});
