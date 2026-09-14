import { describe, expect, it } from "vitest";
import { checkLogValueParts, checkLogValueSummary, formatLogNumber } from "./checkLogs.ts";

describe("formatLogNumber", () => {
  it("converts milli units to a trimmed decimal", () => {
    expect(formatLogNumber(250000, "ml")).toBe("250 ml");
    expect(formatLogNumber(1500, "g")).toBe("1.5 g");
    expect(formatLogNumber(0, "")).toBe("0");
  });
});

describe("checkLogValueParts", () => {
  it("returns selected option labels", () => {
    expect(
      checkLogValueParts({ valueLabels: ["Binkies", "Exploring"], valueText: "", valueMilli: null, typeUnit: "" }),
    ).toEqual(["Binkies", "Exploring"]);
  });

  it("includes free text and a number with its unit", () => {
    expect(
      checkLogValueParts({ valueLabels: [], valueText: "Hay top-up", valueMilli: 120000, typeUnit: "g" }),
    ).toEqual(["Hay top-up", "120 g"]);
  });

  it("drops empty fields", () => {
    expect(checkLogValueParts({ valueLabels: [], valueText: "", valueMilli: null, typeUnit: "" })).toEqual([]);
  });

  it("summarises with a separator", () => {
    expect(
      checkLogValueSummary({ valueLabels: ["Normal"], valueText: "", valueMilli: 50000, typeUnit: "ml" }),
    ).toBe("Normal · 50 ml");
  });
});
