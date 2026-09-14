import { describe, expect, it } from "vitest";
import {
  checklistAnswerLines,
  dateRangesOverlap,
  isDateWithinRange,
  isWithinRange,
  localDateValue,
  resolveReportRange,
} from "./report.ts";

const NOW = new Date(2026, 8, 15, 14, 30);

describe("resolveReportRange", () => {
  it("covers today for the day preset", () => {
    const range = resolveReportRange("day", NOW);
    expect(range.from?.getTime()).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).getTime());
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 15, 23, 59, 59, 999).getTime());
  });

  it("covers the last seven days for the week preset", () => {
    const range = resolveReportRange("week", NOW);
    expect(range.from?.getTime()).toBe(new Date(2026, 8, 9, 0, 0, 0, 0).getTime());
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 15, 23, 59, 59, 999).getTime());
  });

  it("covers the last thirty days for the month preset", () => {
    const range = resolveReportRange("month", NOW);
    expect(range.from?.getTime()).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 15, 23, 59, 59, 999).getTime());
  });

  it("has no bounds for the all-time preset", () => {
    expect(resolveReportRange("all", NOW)).toEqual({ from: null, to: null });
  });

  it("uses inclusive day bounds for custom dates", () => {
    const range = resolveReportRange("custom", NOW, "2026-09-01", "2026-09-10");
    expect(range.from?.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 10, 23, 59, 59, 999).getTime());
  });

  it("swaps reversed custom dates", () => {
    const range = resolveReportRange("custom", NOW, "2026-09-10", "2026-09-01");
    expect(range.from?.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 10, 23, 59, 59, 999).getTime());
  });

  it("leaves missing custom sides open", () => {
    const range = resolveReportRange("custom", NOW, "", "2026-09-10");
    expect(range.from).toBeNull();
    expect(range.to?.getTime()).toBe(new Date(2026, 8, 10, 23, 59, 59, 999).getTime());
  });

  it("ignores malformed custom dates", () => {
    const range = resolveReportRange("custom", NOW, "nonsense", "");
    expect(range).toEqual({ from: null, to: null });
  });
});

describe("isWithinRange", () => {
  const range = resolveReportRange("week", NOW);

  it("includes values inside the range", () => {
    expect(isWithinRange(new Date(2026, 8, 12, 9, 0).toISOString(), range)).toBe(true);
  });

  it("includes the exact bounds", () => {
    expect(isWithinRange(new Date(2026, 8, 9, 0, 0, 0, 0).toISOString(), range)).toBe(true);
    expect(isWithinRange(new Date(2026, 8, 15, 23, 59, 59, 999).toISOString(), range)).toBe(true);
  });

  it("excludes values outside the range", () => {
    expect(isWithinRange(new Date(2026, 8, 8, 23, 59).toISOString(), range)).toBe(false);
    expect(isWithinRange(new Date(2026, 8, 16, 0, 0).toISOString(), range)).toBe(false);
  });

  it("treats an all-time range as everything with a value", () => {
    const all = resolveReportRange("all", NOW);
    expect(isWithinRange("2020-01-01T00:00:00.000Z", all)).toBe(true);
    expect(isWithinRange(null, all)).toBe(false);
    expect(isWithinRange("", all)).toBe(false);
  });
});

describe("isDateWithinRange", () => {
  const range = resolveReportRange("custom", NOW, "2026-09-01", "2026-09-10");

  it("compares calendar days inclusively", () => {
    expect(isDateWithinRange("2026-09-01", range)).toBe(true);
    expect(isDateWithinRange("2026-09-10", range)).toBe(true);
    expect(isDateWithinRange("2026-08-31", range)).toBe(false);
    expect(isDateWithinRange("2026-09-11", range)).toBe(false);
  });

  it("treats missing values as outside a bounded range", () => {
    expect(isDateWithinRange(null, range)).toBe(false);
  });
});

describe("dateRangesOverlap", () => {
  const range = resolveReportRange("custom", NOW, "2026-09-01", "2026-09-10");

  it("includes a course that overlaps the period", () => {
    expect(dateRangesOverlap("2026-08-25", "2026-09-02", range, NOW)).toBe(true);
    expect(dateRangesOverlap("2026-09-09", "2026-09-20", range, NOW)).toBe(true);
  });

  it("includes a course fully inside the period", () => {
    expect(dateRangesOverlap("2026-09-03", "2026-09-05", range, NOW)).toBe(true);
  });

  it("excludes a course that ends before the period", () => {
    expect(dateRangesOverlap("2026-08-01", "2026-08-31", range, NOW)).toBe(false);
  });

  it("excludes a course that starts after the period", () => {
    expect(dateRangesOverlap("2026-09-11", "2026-09-20", range, NOW)).toBe(false);
  });

  it("treats an open-ended course as ongoing", () => {
    expect(dateRangesOverlap("2026-08-01", null, range, NOW)).toBe(true);
  });

  it("treats an all-time range as everything", () => {
    const all = resolveReportRange("all", NOW);
    expect(dateRangesOverlap("2020-01-01", "2020-02-01", all, NOW)).toBe(true);
  });
});

describe("localDateValue", () => {
  it("formats a local calendar day", () => {
    expect(localDateValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("checklistAnswerLines", () => {
  const sections = [
    {
      key: "posture",
      label: "Posture",
      options: [
        { value: "hunched", label: "Hunched" },
        { value: "relaxed", label: "Relaxed" },
      ],
    },
  ];
  const dailyTypes = [
    { key: "water", label: "Water intake", unit: "ml" },
    { key: "behaviour", label: "Behaviour", unit: "" },
  ];

  it("maps weekly checklist values to option labels", () => {
    expect(
      checklistAnswerLines({ posture: { values: ["hunched"], other: "" } }, sections, dailyTypes),
    ).toEqual(["Posture: Hunched"]);
  });

  it("formats daily answers with amounts, text and multiple options", () => {
    expect(
      checklistAnswerLines(
        {
          "daily:water": { values: [], other: "", numberMilli: 250000 },
          "daily:behaviour": { values: ["Binkies", "Exploring"], other: "" },
        },
        sections,
        dailyTypes,
      ),
    ).toEqual(["Water intake: 250 ml", "Behaviour: Binkies, Exploring"]);
  });

  it("includes free text and other details", () => {
    expect(
      checklistAnswerLines(
        {
          "daily:behaviour": { values: ["Quiet"], other: "", text: "Settled after meds" },
          posture: { values: [], other: "Leaning" },
        },
        sections,
        dailyTypes,
      ),
    ).toEqual(["Posture: Other: Leaning", "Behaviour: Quiet, Settled after meds"]);
  });

  it("falls back to the key for unknown daily types and drops empty answers", () => {
    expect(
      checklistAnswerLines(
        { "daily:ghost": { values: ["Boo"], other: "" }, posture: { values: [], other: "" } },
        sections,
        dailyTypes,
      ),
    ).toEqual(["ghost: Boo"]);
  });
});
