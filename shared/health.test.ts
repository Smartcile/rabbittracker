import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  ageLabel,
  assessWeightChange,
  careDueStatus,
  dueStatus,
  formatWeight,
  needsAttention,
  overdueFollowUps,
  parseWeightInput,
  taskDueStatus,
  taskNextDueOn,
  upcomingAppointments,
  validateBodyCondition,
  weightChangePct,
  weightDeltaGrams,
  weightInputValue,
  weightSummary,
  weightTrend,
} from "./health.ts";

describe("formatWeight", () => {
  it("formats kilograms with two decimals", () => {
    expect(formatWeight(2350)).toBe("2.35 kg");
    expect(formatWeight(1000)).toBe("1.00 kg");
  });

  it("formats grams below one kilogram", () => {
    expect(formatWeight(850)).toBe("850 g");
    expect(formatWeight(999)).toBe("999 g");
  });

  it("renders a dash for missing weights", () => {
    expect(formatWeight(null)).toBe("—");
    expect(formatWeight(undefined)).toBe("—");
  });
});

describe("weightInputValue", () => {
  it("converts grams to a trimmed kilogram string", () => {
    expect(weightInputValue(2350)).toBe("2.35");
    expect(weightInputValue(850)).toBe("0.85");
    expect(weightInputValue(2000)).toBe("2");
  });

  it("returns an empty string for missing weights", () => {
    expect(weightInputValue(null)).toBe("");
  });
});

describe("parseWeightInput", () => {
  it("parses bare numbers as kilograms", () => {
    expect(parseWeightInput("2.35")).toBe(2350);
    expect(parseWeightInput("0.85")).toBe(850);
  });

  it("parses explicit kilogram units", () => {
    expect(parseWeightInput("2.35kg")).toBe(2350);
    expect(parseWeightInput("2.35 kg")).toBe(2350);
  });

  it("parses explicit gram units", () => {
    expect(parseWeightInput("2350g")).toBe(2350);
    expect(parseWeightInput("2350 g")).toBe(2350);
    expect(parseWeightInput("850G")).toBe(850);
  });

  it("rejects empty and malformed input", () => {
    expect(parseWeightInput("")).toBeNull();
    expect(parseWeightInput("abc")).toBeNull();
    expect(parseWeightInput("2,35")).toBeNull();
    expect(parseWeightInput("-1")).toBeNull();
  });
});

describe("weightDeltaGrams", () => {
  it("is positive for gains and negative for losses", () => {
    expect(weightDeltaGrams(2300, 2350)).toBe(50);
    expect(weightDeltaGrams(2350, 2300)).toBe(-50);
  });
});

describe("weightChangePct", () => {
  it("computes percentage change", () => {
    expect(weightChangePct(2000, 2100)).toBeCloseTo(5);
    expect(weightChangePct(2000, 1900)).toBeCloseTo(-5);
  });

  it("returns zero when the previous weight is zero", () => {
    expect(weightChangePct(0, 100)).toBe(0);
  });
});

describe("assessWeightChange", () => {
  it("treats gains and stable weights as ok", () => {
    expect(assessWeightChange(2000, 2100, 7)).toBe("ok");
    expect(assessWeightChange(2000, 2000, 7)).toBe("ok");
  });

  it("treats a loss of exactly 2% as ok", () => {
    expect(assessWeightChange(2000, 1960, 7)).toBe("ok");
  });

  it("flags a loss over 2% as watch", () => {
    expect(assessWeightChange(2000, 1940, 7)).toBe("watch");
  });

  it("treats a loss of exactly 5% as watch", () => {
    expect(assessWeightChange(2000, 1900, 7)).toBe("watch");
  });

  it("flags a loss over 5% as alert regardless of duration", () => {
    expect(assessWeightChange(2000, 1880, 100)).toBe("alert");
    expect(assessWeightChange(2000, 1880, 10)).toBe("alert");
  });

  it("flags a large loss over a long period as alert", () => {
    expect(assessWeightChange(2000, 1800, 100)).toBe("alert");
  });

  it("treats a zero previous weight as ok", () => {
    expect(assessWeightChange(0, 100, 7)).toBe("ok");
  });
});

describe("weightTrend", () => {
  it("returns nulls for an empty series", () => {
    expect(weightTrend([])).toEqual({
      points: [],
      latest: null,
      previous: null,
      min: null,
      max: null,
      average: null,
      changeFromFirst: null,
      changeFromPrevious: null,
    });
  });

  it("ignores checks without weights", () => {
    const trend = weightTrend([
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: null },
      { checkedAt: "2026-01-02T00:00:00.000Z", weightGrams: 2000 },
    ]);
    expect(trend.points).toHaveLength(1);
    expect(trend.latest).toBe(2000);
  });

  it("sorts points chronologically", () => {
    const trend = weightTrend([
      { checkedAt: "2026-03-01T00:00:00.000Z", weightGrams: 2100 },
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 },
      { checkedAt: "2026-02-01T00:00:00.000Z", weightGrams: 2050 },
    ]);
    expect(trend.points.map((point) => point.weightGrams)).toEqual([2000, 2050, 2100]);
  });

  it("computes aggregates and deltas", () => {
    const trend = weightTrend([
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 },
      { checkedAt: "2026-02-01T00:00:00.000Z", weightGrams: 2100 },
      { checkedAt: "2026-03-01T00:00:00.000Z", weightGrams: 2050 },
    ]);
    expect(trend.latest).toBe(2050);
    expect(trend.previous).toBe(2100);
    expect(trend.min).toBe(2000);
    expect(trend.max).toBe(2100);
    expect(trend.average).toBe(2050);
    expect(trend.changeFromFirst).toBe(50);
    expect(trend.changeFromPrevious).toBe(-50);
  });

  it("handles a single data point", () => {
    const trend = weightTrend([{ checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 }]);
    expect(trend.latest).toBe(2000);
    expect(trend.previous).toBeNull();
    expect(trend.changeFromPrevious).toBeNull();
    expect(trend.changeFromFirst).toBe(0);
    expect(trend.average).toBe(2000);
  });
});

describe("validateBodyCondition", () => {
  it("accepts 1 to 5 inclusive", () => {
    expect(validateBodyCondition(1)).toBe(true);
    expect(validateBodyCondition(5)).toBe(true);
  });

  it("rejects out-of-range and fractional values", () => {
    expect(validateBodyCondition(0)).toBe(false);
    expect(validateBodyCondition(6)).toBe(false);
    expect(validateBodyCondition(1.5)).toBe(false);
  });
});

describe("weightSummary", () => {
  it("returns nulls without weights", () => {
    expect(weightSummary([])).toEqual({
      latestWeightGrams: null,
      weightChangeGrams: null,
      weightAlert: null,
    });
  });

  it("returns only the latest weight with a single point", () => {
    expect(weightSummary([{ checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 }])).toEqual({
      latestWeightGrams: 2000,
      weightChangeGrams: null,
      weightAlert: null,
    });
  });

  it("reports a gain as ok", () => {
    const summary = weightSummary([
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 },
      { checkedAt: "2026-01-08T00:00:00.000Z", weightGrams: 2050 },
    ]);
    expect(summary.weightChangeGrams).toBe(50);
    expect(summary.weightAlert).toBe("ok");
  });

  it("reports a slow small loss as watch", () => {
    const summary = weightSummary([
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 },
      { checkedAt: "2026-02-01T00:00:00.000Z", weightGrams: 1940 },
    ]);
    expect(summary.weightAlert).toBe("watch");
  });

  it("reports a fast loss as alert", () => {
    const summary = weightSummary([
      { checkedAt: "2026-01-01T00:00:00.000Z", weightGrams: 2000 },
      { checkedAt: "2026-01-05T00:00:00.000Z", weightGrams: 1880 },
    ]);
    expect(summary.weightAlert).toBe("alert");
  });
});

describe("dueStatus", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns none without a date", () => {
    expect(dueStatus(null, now)).toBe("none");
    expect(dueStatus(undefined, now)).toBe("none");
  });

  it("treats due today as due-soon", () => {
    expect(dueStatus("2026-06-15", now)).toBe("due-soon");
  });

  it("treats due exactly soonDays ahead as due-soon", () => {
    expect(dueStatus("2026-07-15", now, 30)).toBe("due-soon");
  });

  it("treats one day past soonDays as ok", () => {
    expect(dueStatus("2026-07-16", now, 30)).toBe("ok");
  });

  it("treats yesterday as overdue", () => {
    expect(dueStatus("2026-06-14", now)).toBe("overdue");
  });

  it("respects a custom soonDays", () => {
    expect(dueStatus("2026-06-17", now, 2)).toBe("due-soon");
    expect(dueStatus("2026-06-18", now, 2)).toBe("ok");
  });
});

describe("careDueStatus", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns none for a non-positive interval", () => {
    expect(careDueStatus("2026-06-01", 0, now)).toBe("none");
    expect(careDueStatus("2026-06-01", -5, now)).toBe("none");
  });

  it("treats a missing record as overdue", () => {
    expect(careDueStatus(null, 30, now)).toBe("overdue");
  });

  it("treats due today as due-soon", () => {
    expect(careDueStatus("2026-05-16", 30, now)).toBe("due-soon");
  });

  it("treats due exactly soonDays ahead as due-soon", () => {
    expect(careDueStatus("2026-05-16", 37, now)).toBe("due-soon");
  });

  it("treats one day past soonDays as ok", () => {
    expect(careDueStatus("2026-05-16", 38, now)).toBe("ok");
  });

  it("treats one day overdue as overdue", () => {
    expect(careDueStatus("2026-05-15", 30, now)).toBe("overdue");
  });
});

describe("taskDueStatus", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("treats a never-completed task as due", () => {
    expect(taskDueStatus(null, 1, now)).toBe("due");
    expect(taskNextDueOn(null, 1)).toBeNull();
  });

  it("is upcoming once completed today for a daily task", () => {
    expect(taskDueStatus("2026-06-15T08:00:00.000Z", 1, now)).toBe("upcoming");
    expect(taskNextDueOn("2026-06-15T08:00:00.000Z", 1)).toBe("2026-06-16");
  });

  it("is due when the interval has elapsed", () => {
    expect(taskDueStatus("2026-06-13T08:00:00.000Z", 2, now)).toBe("due");
    expect(taskDueStatus("2026-06-13T08:00:00.000Z", 1, now)).toBe("due");
  });

  it("stays upcoming for a longer interval", () => {
    expect(taskDueStatus("2026-06-14T08:00:00.000Z", 3, now)).toBe("upcoming");
    expect(taskNextDueOn("2026-06-14T08:00:00.000Z", 3)).toBe("2026-06-17");
  });
});

describe("needsAttention", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns nothing for a clean rabbit", () => {
    expect(needsAttention({}, now)).toEqual([]);
  });

  it("orders vaccinations, care, weight, then follow-ups", () => {
    const badges = needsAttention(
      {
        vaccinations: [{ vaccine: "RHDV2", nextDueAt: "2026-06-01" }],
        care: [{ kind: "nails", lastDoneAt: "2026-01-01", intervalDays: 30 }],
        weightAlert: "alert",
        followUps: [{ title: "Recheck", followUpAt: "2026-06-10T09:00:00.000Z" }],
      },
      now,
    );
    expect(badges.map((badge) => badge.kind)).toEqual([
      "vaccination",
      "care",
      "weight",
      "follow-up",
    ]);
    expect(badges.every((badge) => badge.severity === "alert")).toBe(true);
  });

  it("marks a due-soon vaccine as watch", () => {
    const badges = needsAttention({ vaccinations: [{ vaccine: "RHDV2", nextDueAt: "2026-06-20" }] }, now);
    expect(badges).toEqual([
      { kind: "vaccination", label: "RHDV2 vaccine due soon", severity: "watch" },
    ]);
  });

  it("flags care with no record as overdue", () => {
    const badges = needsAttention({ care: [{ kind: "teeth", lastDoneAt: null, intervalDays: 60 }] }, now);
    expect(badges).toEqual([{ kind: "care", label: "Teeth overdue", severity: "alert" }]);
  });

  it("ignores future follow-ups", () => {
    const badges = needsAttention(
      { followUps: [{ title: "Recheck", followUpAt: "2026-07-01T09:00:00.000Z" }] },
      now,
    );
    expect(badges).toEqual([]);
  });

  it("marks a weight watch", () => {
    const badges = needsAttention({ weightAlert: "watch" }, now);
    expect(badges).toEqual([{ kind: "weight", label: "Weight watch", severity: "watch" }]);
  });
});

describe("upcomingAppointments", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");
  const appointments = [
    { title: "Past", scheduledAt: "2026-06-10T09:00:00.000Z", status: "scheduled" },
    { title: "Soon", scheduledAt: "2026-06-20T09:00:00.000Z", status: "scheduled" },
    { title: "Later", scheduledAt: "2026-07-20T09:00:00.000Z", status: "scheduled" },
    { title: "Cancelled", scheduledAt: "2026-06-18T09:00:00.000Z", status: "cancelled" },
  ];

  it("keeps only scheduled appointments inside the window", () => {
    const result = upcomingAppointments(appointments, now, 14);
    expect(result.map((appointment) => appointment.title)).toEqual(["Soon"]);
  });

  it("sorts by scheduled time", () => {
    const result = upcomingAppointments(appointments, now, 60);
    expect(result.map((appointment) => appointment.title)).toEqual(["Soon", "Later"]);
  });

  it("returns nothing for an empty window", () => {
    expect(upcomingAppointments(appointments, now, 0)).toEqual([]);
  });
});

describe("overdueFollowUps", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("keeps overdue follow-ups on scheduled appointments", () => {
    const result = overdueFollowUps(
      [
        { title: "Recheck", followUpAt: "2026-06-10T09:00:00.000Z", status: "scheduled" },
        { title: "Future", followUpAt: "2026-07-01T09:00:00.000Z", status: "scheduled" },
        { title: "Done", followUpAt: "2026-06-01T09:00:00.000Z", status: "completed" },
        { title: "None", followUpAt: null, status: "scheduled" },
      ],
      now,
    );
    expect(result.map((appointment) => appointment.title)).toEqual(["Recheck"]);
  });

  it("sorts by follow-up time", () => {
    const result = overdueFollowUps(
      [
        { title: "Second", followUpAt: "2026-06-12T09:00:00.000Z", status: "scheduled" },
        { title: "First", followUpAt: "2026-06-01T09:00:00.000Z", status: "scheduled" },
      ],
      now,
    );
    expect(result.map((appointment) => appointment.title)).toEqual(["First", "Second"]);
  });
});

describe("ageFromDob", () => {
  it("returns whole years on a birthday", () => {
    expect(ageFromDob("2020-01-15", new Date("2026-01-15T12:00:00Z"))).toEqual({
      years: 6,
      months: 0,
    });
  });

  it("returns years and months before the birthday in the same month", () => {
    expect(ageFromDob("2020-01-15", new Date("2026-02-20T00:00:00Z"))).toEqual({
      years: 6,
      months: 1,
    });
  });

  it("counts the last day before a birthday as one month less", () => {
    expect(ageFromDob("2020-01-15", new Date("2026-01-14T00:00:00Z"))).toEqual({
      years: 5,
      months: 11,
    });
  });

  it("handles a leap-day birthday before March", () => {
    expect(ageFromDob("2024-02-29", new Date("2026-02-28T00:00:00Z"))).toEqual({
      years: 1,
      months: 11,
    });
  });

  it("handles a leap-day birthday from March", () => {
    expect(ageFromDob("2024-02-29", new Date("2026-03-01T00:00:00Z"))).toEqual({
      years: 2,
      months: 0,
    });
  });

  it("returns zero for an invalid date", () => {
    expect(ageFromDob("not-a-date", new Date("2026-01-01T00:00:00Z"))).toEqual({
      years: 0,
      months: 0,
    });
  });

  it("clamps a future date of birth to zero", () => {
    expect(ageFromDob("2027-01-01", new Date("2026-01-01T00:00:00Z"))).toEqual({
      years: 0,
      months: 0,
    });
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("returns unknown when there is no date of birth", () => {
    expect(ageLabel(null, now)).toBe("Age unknown");
  });

  it("labels under one month", () => {
    expect(ageLabel("2026-06-01", now)).toBe("Under 1 month");
  });

  it("labels months only", () => {
    expect(ageLabel("2026-03-15", now)).toBe("3 months");
  });

  it("labels a single month", () => {
    expect(ageLabel("2026-05-15", now)).toBe("1 month");
  });

  it("labels whole years", () => {
    expect(ageLabel("2024-06-15", now)).toBe("2 years");
  });

  it("labels a single year", () => {
    expect(ageLabel("2025-06-15", now)).toBe("1 year");
  });

  it("labels years and months", () => {
    expect(ageLabel("2024-01-15", now)).toBe("2y 5m");
  });
});
