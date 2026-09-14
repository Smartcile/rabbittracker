import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { uidsToPrune } from "../src/services/calendarSync.ts";
import { parseIcs } from "../src/services/ical.ts";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/vet.ics", import.meta.url)), "utf8");

describe("parseIcs", () => {
  it("parses all events with a UID", () => {
    const events = parseIcs(fixture);
    expect(events).toHaveLength(5);
    expect(events.map((event) => event.uid)).toEqual([
      "event-1@test",
      "event-2@test",
      "event-3@test",
      "event-4@test",
      "event-5@test",
    ]);
  });

  it("parses a UTC timed event", () => {
    const event = parseIcs(fixture)[0];
    expect(event.summary).toBe("Vet visit");
    expect(event.location).toBe("Happy Paws Clinic");
    expect(event.description).toBe("Annual check, bring hay");
    expect(event.startAt).toBe("2026-09-14T10:00:00.000Z");
    expect(event.endAt).toBe("2026-09-14T10:45:00.000Z");
    expect(event.allDay).toBe(false);
    expect(event.cancelled).toBe(false);
  });

  it("parses an all-day event as UTC midnight", () => {
    const event = parseIcs(fixture)[1];
    expect(event.allDay).toBe(true);
    expect(event.startAt).toBe("2026-09-20T00:00:00.000Z");
    expect(event.endAt).toBe("2026-09-21T00:00:00.000Z");
  });

  it("converts a TZID wall time to UTC", () => {
    const event = parseIcs(fixture)[2];
    expect(event.startAt).toBe("2026-09-14T21:30:00.000Z");
    expect(event.endAt).toBe("2026-09-14T22:15:00.000Z");
  });

  it("marks cancelled events", () => {
    const event = parseIcs(fixture)[3];
    expect(event.cancelled).toBe(true);
  });

  it("unfolds folded lines", () => {
    const event = parseIcs(fixture)[4];
    expect(event.summary).toBe("Folded summary that continues here");
  });

  it("returns an empty list for empty input", () => {
    expect(parseIcs("")).toEqual([]);
  });

  it("ignores events without a UID", () => {
    const events = parseIcs(
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:No uid\nDTSTART:20260101T000000Z\nEND:VEVENT\nEND:VCALENDAR",
    );
    expect(events).toEqual([]);
  });

  it("treats a floating time as UTC", () => {
    const events = parseIcs(
      "BEGIN:VEVENT\nUID:float@test\nDTSTART:20260101T120000\nEND:VEVENT",
    );
    expect(events[0].startAt).toBe("2026-01-01T12:00:00.000Z");
  });

  it("handles CRLF line endings", () => {
    const events = parseIcs(
      "BEGIN:VEVENT\r\nUID:crlf@test\r\nSUMMARY:CRLF event\r\nDTSTART:20260101T120000Z\r\nEND:VEVENT\r\n",
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("CRLF event");
  });
});

describe("uidsToPrune", () => {
  it("prunes events missing from the feed", () => {
    const prune = uidsToPrune(["a", "b"], new Set(["a"]), new Set());
    expect(prune).toEqual(["b"]);
  });

  it("keeps events still present in the feed", () => {
    expect(uidsToPrune(["a"], new Set(["a"]), new Set())).toEqual([]);
  });

  it("keeps events linked to an appointment", () => {
    expect(uidsToPrune(["a", "b"], new Set(), new Set(["b"]))).toEqual(["a"]);
  });
});
