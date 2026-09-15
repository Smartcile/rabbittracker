import { describe, expect, it } from "vitest";
import {
  ageInDays,
  expectedWeightRange,
  growthRatio,
  rangeLevel,
  stagePhase,
} from "./growth.ts";

describe("growthRatio", () => {
  it("returns the starting ratio for newborn bunnies", () => {
    expect(growthRatio(0)).toBeCloseTo(0.06, 5);
  });

  it("reaches adult size around eight months", () => {
    expect(growthRatio(240)).toBe(1);
    expect(growthRatio(365)).toBe(1);
  });

  it("interpolates between the curve points", () => {
    const mid = growthRatio(45);
    expect(mid).toBeGreaterThan(0.22);
    expect(mid).toBeLessThan(0.42);
  });
});

describe("expectedWeightRange", () => {
  it("scales the adult range by age", () => {
    expect(expectedWeightRange({ minGrams: 1000, maxGrams: 2000 }, 240)).toEqual({
      minGrams: 1000,
      maxGrams: 2000,
    });
    expect(expectedWeightRange({ minGrams: 1000, maxGrams: 2000 }, 0)).toEqual({
      minGrams: 60,
      maxGrams: 120,
    });
  });
});

describe("ageInDays", () => {
  it("counts whole days from the date of birth", () => {
    expect(ageInDays("2026-01-01", new Date("2026-01-31T12:00:00Z"))).toBe(30);
    expect(ageInDays("2026-01-01", new Date("2026-01-01T12:00:00Z"))).toBe(0);
  });
});

describe("rangeLevel", () => {
  it("is ok inside the range", () => {
    expect(rangeLevel(1500, { minGrams: 1000, maxGrams: 2000 })).toBe("ok");
  });

  it("is a watch just outside and an alert further out", () => {
    expect(rangeLevel(950, { minGrams: 1000, maxGrams: 2000 })).toBe("watch");
    expect(rangeLevel(500, { minGrams: 1000, maxGrams: 2000 })).toBe("alert");
  });
});

describe("stagePhase", () => {
  const stage = { startDays: 120, endDays: 180 };

  it("marks completed stages as done", () => {
    expect(stagePhase(stage, 200, true)).toBe("done");
  });

  it("marks stages before, during and after the window", () => {
    expect(stagePhase(stage, 90, false)).toBe("upcoming");
    expect(stagePhase(stage, 150, false)).toBe("current");
    expect(stagePhase(stage, 200, false)).toBe("overdue");
  });
});
