import { describe, expect, it } from "vitest";
import { taskScheduleDays } from "./tasks.ts";

describe("taskScheduleDays", () => {
  it("schedules a daily task from its start date", () => {
    expect(
      taskScheduleDays({ startDate: "2026-09-01", intervalDays: 1 }, [], "2026-09-01", "2026-09-04"),
    ).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  });

  it("schedules on the interval from the start date", () => {
    expect(
      taskScheduleDays({ startDate: "2026-09-01", intervalDays: 3 }, [], "2026-09-01", "2026-09-10"),
    ).toEqual(["2026-09-01", "2026-09-04", "2026-09-07", "2026-09-10"]);
  });

  it("only returns days inside the requested range", () => {
    expect(
      taskScheduleDays({ startDate: "2026-09-01", intervalDays: 3 }, [], "2026-09-05", "2026-09-08"),
    ).toEqual(["2026-09-07"]);
  });

  it("falls back to the earliest completion when there is no start date", () => {
    expect(
      taskScheduleDays(
        { startDate: null, intervalDays: 2 },
        ["2026-09-10", "2026-09-03"],
        "2026-09-09",
        "2026-09-13",
      ),
    ).toEqual(["2026-09-09", "2026-09-11", "2026-09-13"]);
  });

  it("returns nothing without a start date or completion", () => {
    expect(taskScheduleDays({ startDate: null, intervalDays: 1 }, [], "2026-09-01", "2026-09-05")).toEqual([]);
  });

  it("returns nothing when the range ends before the anchor", () => {
    expect(
      taskScheduleDays({ startDate: "2026-10-01", intervalDays: 1 }, [], "2026-09-01", "2026-09-05"),
    ).toEqual([]);
  });
});
