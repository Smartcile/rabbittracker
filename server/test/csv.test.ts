import { describe, expect, it } from "vitest";
import { csvEscape, formatDateInZone, formatDateTimeInZone, toCsv } from "../src/services/csv.ts";

describe("csvEscape", () => {
  it("passes through plain values", () => {
    expect(csvEscape("Clover")).toBe("Clover");
    expect(csvEscape(2350)).toBe("2350");
  });

  it("returns an empty string for null and undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvEscape("hay, pellets")).toBe('"hay, pellets"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and adds a BOM", () => {
    const csv = toCsv([
      ["Date", "Rabbit"],
      ["2026-09-14", "Clover"],
    ]);
    expect(csv).toBe("\uFEFFDate,Rabbit\r\n2026-09-14,Clover\r\n");
  });

  it("escapes values per cell", () => {
    const csv = toCsv([["a,b", 'c"d']]);
    expect(csv).toBe('\uFEFF"a,b","c""d"\r\n');
  });
});

describe("timezone formatting", () => {
  it("formats a date in the configured zone", () => {
    const value = new Date("2026-09-14T21:30:00.000Z");
    expect(formatDateInZone(value, "Pacific/Auckland")).toBe("2026-09-15");
    expect(formatDateInZone(value, "UTC")).toBe("2026-09-14");
  });

  it("formats a date and time in the configured zone", () => {
    const value = new Date("2026-09-14T21:30:00.000Z");
    expect(formatDateTimeInZone(value, "Pacific/Auckland")).toBe("2026-09-15 09:30");
  });
});
