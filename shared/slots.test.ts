import { describe, expect, it } from "vitest";
import {
  DAY_SLOT_LABELS,
  DAY_SLOTS,
  allSlotsDone,
  nearestSlot,
  nextPendingSlot,
  slotForTime,
  slotRangeLabel,
  slotStatus,
  slotTimeStatus,
} from "./slots.ts";

describe("day slots", () => {
  it("labels every slot", () => {
    for (const slot of DAY_SLOTS) {
      expect(DAY_SLOT_LABELS[slot].length).toBeGreaterThan(0);
      expect(slotRangeLabel(slot)).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
    }
  });
});

describe("slotForTime", () => {
  it("maps each time of day to its slot", () => {
    expect(slotForTime(new Date(2026, 8, 1, 6, 30))).toBe("early_morning");
    expect(slotForTime(new Date(2026, 8, 1, 9, 0))).toBe("morning");
    expect(slotForTime(new Date(2026, 8, 1, 14, 0))).toBe("afternoon");
    expect(slotForTime(new Date(2026, 8, 1, 19, 0))).toBe("evening");
    expect(slotForTime(new Date(2026, 8, 1, 23, 0))).toBe("night");
    expect(slotForTime(new Date(2026, 8, 1, 2, 0))).toBe("night");
  });
});

describe("nearestSlot", () => {
  it("picks the slot containing the time", () => {
    expect(nearestSlot(["morning", "evening"], new Date(2026, 8, 1, 9, 0))).toBe("morning");
  });

  it("falls back to the closest configured slot", () => {
    expect(nearestSlot(["morning", "night"], new Date(2026, 8, 1, 20, 30))).toBe("night");
    expect(nearestSlot(["morning", "evening"], new Date(2026, 8, 1, 20, 30))).toBe("evening");
  });

  it("returns null without slots", () => {
    expect(nearestSlot([], new Date(2026, 8, 1, 9, 0))).toBeNull();
  });
});

describe("slotTimeStatus", () => {
  it("flags doses inside the window as on time", () => {
    expect(slotTimeStatus("morning", new Date(2026, 8, 1, 9, 30))).toBe("on_time");
    expect(slotTimeStatus("night", new Date(2026, 8, 1, 23, 30))).toBe("on_time");
    expect(slotTimeStatus("night", new Date(2026, 8, 1, 2, 0))).toBe("on_time");
  });

  it("flags doses outside the window as early or late", () => {
    expect(slotTimeStatus("morning", new Date(2026, 8, 1, 7, 0))).toBe("early");
    expect(slotTimeStatus("morning", new Date(2026, 8, 1, 13, 0))).toBe("late");
    expect(slotTimeStatus("night", new Date(2026, 8, 1, 6, 0))).toBe("late");
    expect(slotTimeStatus("night", new Date(2026, 8, 1, 19, 0))).toBe("early");
  });
});

describe("slotStatus", () => {
  it("marks slots that have a matching log", () => {
    const status = slotStatus(["morning", "evening"], [{ slot: "morning" }, { slot: null }]);
    expect(status).toEqual([
      { slot: "morning", done: true, missed: false, status: null },
      { slot: "evening", done: false, missed: false, status: null },
    ]);
  });

  it("marks skipped doses as missed but accounted for", () => {
    const status = slotStatus(["morning"], [{ slot: "morning", skipped: true }]);
    expect(status[0]?.done).toBe(true);
    expect(status[0]?.missed).toBe(true);
  });

  it("reports the time status when the log carries a timestamp", () => {
    const status = slotStatus(["morning"], [
      { slot: "morning", at: new Date(2026, 8, 1, 13, 0).toISOString() },
    ]);
    expect(status[0]?.status).toBe("late");
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
