import { describe, expect, it } from "vitest";
import { bowlReadingKindLabel, projectBowlWeight, summarizeBowl, summarizeBowlByDay } from "./bowls.ts";
import type { BowlReadingInput } from "./bowls.ts";

function reading(
  id: number,
  readAt: string,
  kind: BowlReadingInput["kind"],
  weightGrams: number,
): BowlReadingInput {
  return { id, readAt, kind, weightGrams };
}

describe("summarizeBowl", () => {
  it("returns empty totals without readings", () => {
    const summary = summarizeBowl([]);
    expect(summary.currentWeightGrams).toBeNull();
    expect(summary.periodStartAt).toBeNull();
    expect(summary.periodConsumptionGrams).toBe(0);
    expect(summary.totalConsumptionGrams).toBe(0);
    expect(summary.readings).toEqual([]);
  });

  it("measures consumption between weigh-ins", () => {
    const summary = summarizeBowl([
      reading(1, "2026-09-01T08:00:00.000Z", "start", 900),
      reading(2, "2026-09-02T08:00:00.000Z", "weigh", 760),
      reading(3, "2026-09-03T08:00:00.000Z", "weigh", 620),
    ]);
    expect(summary.readings.map((item) => item.consumptionGrams)).toEqual([0, 140, 140]);
    expect(summary.periodConsumptionGrams).toBe(280);
    expect(summary.currentWeightGrams).toBe(620);
    expect(summary.periodStartAt?.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("treats a weight increase as a refill", () => {
    const summary = summarizeBowl([
      reading(1, "2026-09-01T08:00:00.000Z", "start", 900),
      reading(2, "2026-09-02T08:00:00.000Z", "weigh", 600),
      reading(3, "2026-09-02T09:00:00.000Z", "refill", 850),
      reading(4, "2026-09-03T08:00:00.000Z", "weigh", 700),
    ]);
    expect(summary.readings.map((item) => item.refillGrams)).toEqual([0, 0, 250, 0]);
    expect(summary.readings.map((item) => item.consumptionGrams)).toEqual([0, 300, 0, 150]);
    expect(summary.periodConsumptionGrams).toBe(450);
    expect(summary.periodRefillGrams).toBe(250);
    expect(summary.currentWeightGrams).toBe(700);
  });

  it("starts a new period on refresh and keeps overall totals", () => {
    const summary = summarizeBowl([
      reading(1, "2026-09-01T08:00:00.000Z", "start", 900),
      reading(2, "2026-09-02T08:00:00.000Z", "weigh", 600),
      reading(3, "2026-09-03T08:00:00.000Z", "refresh", 850),
      reading(4, "2026-09-04T08:00:00.000Z", "weigh", 800),
    ]);
    expect(summary.readings[2]?.periodStart).toBe(true);
    expect(summary.periodStartAt?.toISOString()).toBe("2026-09-03T08:00:00.000Z");
    expect(summary.periodConsumptionGrams).toBe(50);
    expect(summary.periodRefillGrams).toBe(0);
    expect(summary.totalConsumptionGrams).toBe(350);
    expect(summary.currentWeightGrams).toBe(800);
  });

  it("counts a final weigh-in recorded with the refresh", () => {
    const summary = summarizeBowl([
      reading(1, "2026-09-01T08:00:00.000Z", "start", 900),
      reading(2, "2026-09-02T08:00:00.000Z", "weigh", 600),
      reading(3, "2026-09-03T08:00:00.000Z", "weigh", 580),
      reading(4, "2026-09-03T08:00:00.000Z", "refresh", 850),
    ]);
    expect(summary.readings[2]?.consumptionGrams).toBe(20);
    expect(summary.totalConsumptionGrams).toBe(320);
    expect(summary.currentWeightGrams).toBe(850);
  });

  it("sorts readings by time before rolling", () => {
    const summary = summarizeBowl([
      reading(3, "2026-09-03T08:00:00.000Z", "weigh", 700),
      reading(1, "2026-09-01T08:00:00.000Z", "start", 900),
      reading(2, "2026-09-02T08:00:00.000Z", "weigh", 800),
    ]);
    expect(summary.readings.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(summary.readings.map((item) => item.consumptionGrams)).toEqual([0, 100, 100]);
  });
});

describe("bowlReadingKindLabel", () => {
  it("labels each kind", () => {
    expect(bowlReadingKindLabel("start")).toBe("Start");
    expect(bowlReadingKindLabel("weigh")).toBe("Weigh-in");
    expect(bowlReadingKindLabel("consume")).toBe("Consumption");
    expect(bowlReadingKindLabel("refill")).toBe("Top up");
    expect(bowlReadingKindLabel("refresh")).toBe("Refresh");
  });
});

describe("projectBowlWeight", () => {
  it("returns the current weight without drafts", () => {
    expect(projectBowlWeight(900, [])).toBe(900);
    expect(projectBowlWeight(null, [])).toBeNull();
  });

  it("applies weigh-ins, consumption and top-ups in order", () => {
    expect(
      projectBowlWeight(900, [
        { kind: "weigh", weightGrams: 800 },
        { kind: "consume", consumedGrams: 150 },
        { kind: "refill", refillGrams: 250 },
      ]),
    ).toBe(900);
  });

  it("treats refresh as a new starting weight", () => {
    expect(
      projectBowlWeight(900, [
        { kind: "consume", consumedGrams: 300 },
        { kind: "refresh", weightGrams: 850 },
        { kind: "consume", consumedGrams: 50 },
      ]),
    ).toBe(800);
  });

  it("bases a top-up on the pre-weight when given", () => {
    expect(projectBowlWeight(900, [{ kind: "refill", refillGrams: 250, preWeightGrams: 600 }])).toBe(850);
  });

  it("ignores amounts that need a baseline", () => {
    expect(projectBowlWeight(null, [{ kind: "consume", consumedGrams: 100 }])).toBeNull();
    expect(projectBowlWeight(null, [{ kind: "refill", refillGrams: 100 }])).toBeNull();
  });
});

describe("summarizeBowlByDay", () => {
  it("sums consumption within a single day", () => {
    const summary = summarizeBowlByDay([
      reading(1, new Date(2026, 8, 1, 8, 0).toISOString(), "start", 900),
      reading(2, new Date(2026, 8, 1, 20, 0).toISOString(), "weigh", 800),
    ]);
    expect(summary.days).toEqual([{ day: "2026-09-01", consumptionGrams: 100 }]);
    expect(summary.totalConsumptionGrams).toBe(100);
    expect(summary.spanDays).toBe(1);
    expect(summary.averageConsumptionGrams).toBe(100);
  });

  it("spreads consumption across the days between readings", () => {
    const summary = summarizeBowlByDay([
      reading(1, new Date(2026, 8, 1, 8, 0).toISOString(), "start", 900),
      reading(2, new Date(2026, 8, 3, 8, 0).toISOString(), "weigh", 600),
    ]);
    expect(summary.days).toEqual([
      { day: "2026-09-01", consumptionGrams: 100 },
      { day: "2026-09-02", consumptionGrams: 100 },
      { day: "2026-09-03", consumptionGrams: 100 },
    ]);
    expect(summary.spanDays).toBe(2);
    expect(summary.averageConsumptionGrams).toBe(150);
  });

  it("ignores top-ups and measures consumption after them", () => {
    const summary = summarizeBowlByDay([
      reading(1, new Date(2026, 8, 1, 8, 0).toISOString(), "start", 900),
      reading(2, new Date(2026, 8, 2, 8, 0).toISOString(), "weigh", 600),
      reading(3, new Date(2026, 8, 2, 9, 0).toISOString(), "refill", 850),
      reading(4, new Date(2026, 8, 3, 8, 0).toISOString(), "weigh", 800),
    ]);
    expect(summary.totalConsumptionGrams).toBe(350);
    expect(summary.days.map((day) => day.day)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(summary.averageConsumptionGrams).toBe(175);
  });

  it("returns an empty breakdown without readings", () => {
    const summary = summarizeBowlByDay([]);
    expect(summary.days).toEqual([]);
    expect(summary.averageConsumptionGrams).toBe(0);
  });
});
