import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECURRENCE,
  isScheduledOn,
  normalizeRecurrence,
  recurrenceDays,
  recurrenceFromIntervalDays,
  recurrenceLabel,
  type Recurrence,
} from "./recurrence.ts";

function recurrence(overrides: Partial<Recurrence>): Recurrence {
  return { ...DEFAULT_RECURRENCE, ...overrides };
}

describe("recurrenceDays", () => {
  it("returns every day for a daily schedule", () => {
    expect(
      recurrenceDays(recurrence({ kind: "daily" }), {
        anchorKey: "2026-09-07",
        fromKey: "2026-09-07",
        toKey: "2026-09-09",
      }),
    ).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  it("only returns the chosen weekdays", () => {
    expect(
      recurrenceDays(recurrence({ kind: "weekdays", days: ["mon", "thu"] }), {
        anchorKey: "2026-09-01",
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual(["2026-09-07", "2026-09-10"]);
  });

  it("does not schedule weekdays before the anchor", () => {
    expect(
      recurrenceDays(recurrence({ kind: "weekdays", days: ["mon", "thu"] }), {
        anchorKey: "2026-09-10",
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual(["2026-09-10"]);
  });

  it("shows every candidate day until a weekly quota is met", () => {
    expect(
      recurrenceDays(recurrence({ kind: "per_week", count: 2 }), {
        anchorKey: "2026-09-07",
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("hides the rest of the week once the quota is met", () => {
    expect(
      recurrenceDays(recurrence({ kind: "per_week", count: 2 }), {
        anchorKey: "2026-09-07",
        doneKeys: ["2026-09-08", "2026-09-09"],
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  it("keeps the remaining days when the quota is not met", () => {
    expect(
      recurrenceDays(recurrence({ kind: "per_week", count: 2 }), {
        anchorKey: "2026-09-07",
        doneKeys: ["2026-09-07"],
        fromKey: "2026-09-07",
        toKey: "2026-09-09",
      }),
    ).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  it("counts a weekly quota separately for each week", () => {
    expect(
      recurrenceDays(recurrence({ kind: "per_week", count: 1 }), {
        anchorKey: "2026-09-07",
        doneKeys: ["2026-09-08", "2026-09-14"],
        fromKey: "2026-09-07",
        toKey: "2026-09-15",
      }),
    ).toEqual(["2026-09-07", "2026-09-08", "2026-09-14"]);
  });

  it("schedules on the interval from the anchor", () => {
    expect(
      recurrenceDays(recurrence({ kind: "interval", intervalDays: 2 }), {
        anchorKey: "2026-09-07",
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual(["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-13"]);
  });

  it("cannot project an interval without an anchor", () => {
    expect(
      recurrenceDays(recurrence({ kind: "interval", intervalDays: 2 }), {
        anchorKey: null,
        fromKey: "2026-09-07",
        toKey: "2026-09-13",
      }),
    ).toEqual([]);
  });

  it("returns nothing when the range ends before the anchor", () => {
    expect(
      recurrenceDays(recurrence({ kind: "daily" }), {
        anchorKey: "2026-10-01",
        fromKey: "2026-09-01",
        toKey: "2026-09-05",
      }),
    ).toEqual([]);
  });
});

describe("isScheduledOn", () => {
  it("is true only on scheduled weekdays", () => {
    const value = recurrence({ kind: "weekdays", days: ["mon"] });
    expect(isScheduledOn(value, "2026-09-07", "2026-09-01")).toBe(true);
    expect(isScheduledOn(value, "2026-09-08", "2026-09-01")).toBe(false);
  });

  it("is false on a weekly day once the quota is met", () => {
    const value = recurrence({ kind: "per_week", count: 1 });
    expect(isScheduledOn(value, "2026-09-08", "2026-09-07", ["2026-09-07"])).toBe(false);
  });
});

describe("normalizeRecurrence", () => {
  it("falls back to daily for junk", () => {
    expect(normalizeRecurrence(null)).toEqual(DEFAULT_RECURRENCE);
    expect(normalizeRecurrence({ kind: "nope" })).toEqual(DEFAULT_RECURRENCE);
  });

  it("clamps counts, intervals and unknown weekdays", () => {
    expect(normalizeRecurrence({ kind: "per_week", count: 99 })).toMatchObject({ count: 7 });
    expect(normalizeRecurrence({ kind: "interval", intervalDays: 0 })).toMatchObject({
      intervalDays: 1,
    });
    expect(normalizeRecurrence({ kind: "weekdays", days: ["mon", "mon", "bogus"] })).toMatchObject({
      days: ["mon"],
    });
  });
});

describe("recurrenceFromIntervalDays", () => {
  it("maps 1 to daily and larger values to an interval", () => {
    expect(recurrenceFromIntervalDays(1)).toEqual(DEFAULT_RECURRENCE);
    expect(recurrenceFromIntervalDays(3)).toMatchObject({ kind: "interval", intervalDays: 3 });
  });
});

describe("recurrenceLabel", () => {
  it("labels each kind", () => {
    expect(recurrenceLabel(recurrence({ kind: "daily" }))).toBe("Every day");
    expect(recurrenceLabel(recurrence({ kind: "weekdays", days: ["mon", "thu"] }))).toBe("Mon, Thu");
    expect(recurrenceLabel(recurrence({ kind: "per_week", count: 2 }))).toBe(
      "2 per week (any days)",
    );
    expect(recurrenceLabel(recurrence({ kind: "interval", intervalDays: 2 }))).toBe("Every 2 days");
  });
});
