import { describe, expect, it } from "vitest";
import { expandEntryStart } from "./calendar.ts";

const from = new Date("2026-09-01T00:00:00Z");
const to = new Date("2026-09-30T23:59:59Z");

describe("expandEntryStart", () => {
  it("returns a one-off entry inside the window", () => {
    const at = expandEntryStart(
      { startAt: "2026-09-10T10:00:00Z", repeat: "none", repeatUntil: null },
      from,
      to,
    );
    expect(at.map((date) => date.toISOString())).toEqual(["2026-09-10T10:00:00.000Z"]);
  });

  it("drops a one-off entry outside the window", () => {
    expect(
      expandEntryStart({ startAt: "2026-08-01T10:00:00Z", repeat: "none", repeatUntil: null }, from, to),
    ).toHaveLength(0);
  });

  it("expands weekly occurrences and stops at repeatUntil", () => {
    const at = expandEntryStart(
      { startAt: "2026-09-01T09:00:00Z", repeat: "weekly", repeatUntil: "2026-09-20" },
      from,
      to,
    );
    expect(at.map((date) => date.toISOString())).toEqual([
      "2026-09-01T09:00:00.000Z",
      "2026-09-08T09:00:00.000Z",
      "2026-09-15T09:00:00.000Z",
    ]);
  });

  it("expands daily occurrences within the window", () => {
    const at = expandEntryStart(
      { startAt: "2026-09-28T09:00:00Z", repeat: "daily", repeatUntil: null },
      from,
      to,
    );
    expect(at).toHaveLength(3);
  });

  it("expands monthly occurrences", () => {
    const at = expandEntryStart(
      { startAt: "2026-07-15T09:00:00Z", repeat: "monthly", repeatUntil: null },
      from,
      to,
    );
    expect(at.map((date) => date.toISOString().slice(0, 10))).toEqual(["2026-09-15"]);
  });

  it("ignores an unknown repeat value", () => {
    const at = expandEntryStart(
      { startAt: "2026-09-10T10:00:00Z", repeat: "yearly", repeatUntil: null },
      from,
      to,
    );
    expect(at).toHaveLength(1);
  });
});
