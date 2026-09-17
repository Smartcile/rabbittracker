import { describe, expect, it } from "vitest";
import { parseIcs } from "../src/services/ical.ts";
import { buildFeedEvents, buildIcs, escapeIcsText, foldLine } from "../src/services/icsExport.ts";
import type { FeedSource } from "../src/services/icsExport.ts";

const now = new Date("2026-09-14T00:00:00.000Z");

function source(overrides: Partial<FeedSource> = {}): FeedSource {
  return {
    rabbits: [
      { id: 1, name: "Clover" },
      { id: 2, name: "Biscuit" },
    ],
    appointments: [],
    vaccinations: [],
    tasks: [],
    healthChecks: [],
    treatments: [],
    ...overrides,
  };
}

describe("escapeIcsText", () => {
  it("escapes reserved characters", () => {
    expect(escapeIcsText("a, b; c\\d")).toBe("a\\, b\\; c\\\\d");
  });

  it("turns newlines into literal escapes", () => {
    expect(escapeIcsText("line one\nline two")).toBe("line one\\nline two");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds long lines at 75 octets with space continuations", () => {
    const folded = foldLine(`DESCRIPTION:${"x".repeat(200)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    for (const line of lines.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
    }
    expect(lines.join("").replaceAll(" ", "")).toBe(
      `DESCRIPTION:${"x".repeat(200)}`.replaceAll(" ", ""),
    );
  });

  it("does not split multi-byte characters", () => {
    const folded = foldLine(`SUMMARY:${"🐰".repeat(40)}`);
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      expect(line).not.toContain("�");
    }
  });
});

describe("buildIcs", () => {
  it("wraps events in a calendar with CRLF endings", () => {
    const ics = buildIcs({ calendarName: "RabbitTracker", events: [], now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:RabbitTracker\r\n");
    expect(ics).toContain("VERSION:2.0\r\n");
  });

  it("writes a timed event in UTC", () => {
    const ics = buildIcs({
      calendarName: "Feed",
      now,
      events: [
        {
          uid: "appointment-1@rabbittracker",
          summary: "Clover: Dental check",
          start: "2026-09-18T02:00:00.000Z",
          end: "2026-09-18T03:00:00.000Z",
          description: "Bring hay",
          location: "Happy Paws",
        },
      ],
    });
    expect(ics).toContain("UID:appointment-1@rabbittracker\r\n");
    expect(ics).toContain("DTSTART:20260918T020000Z\r\n");
    expect(ics).toContain("DTEND:20260918T030000Z\r\n");
    expect(ics).toContain("SUMMARY:Clover: Dental check\r\n");
    expect(ics).toContain("LOCATION:Happy Paws\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\n");
  });

  it("writes an all-day event with an exclusive end date", () => {
    const ics = buildIcs({
      calendarName: "Feed",
      now,
      events: [
        {
          uid: "vaccination-1@rabbittracker",
          summary: "Clover: RHDV2 vaccine due",
          start: "2026-09-20",
          allDay: true,
        },
      ],
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260920\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260921\r\n");
  });

  it("marks cancelled events", () => {
    const ics = buildIcs({
      calendarName: "Feed",
      now,
      events: [
        {
          uid: "appointment-2@rabbittracker",
          summary: "Cancelled",
          start: "2026-09-18T02:00:00.000Z",
          cancelled: true,
        },
      ],
    });
    expect(ics).toContain("STATUS:CANCELLED\r\n");
  });

  it("escapes event text", () => {
    const ics = buildIcs({
      calendarName: "Feed",
      now,
      events: [
        {
          uid: "u1",
          summary: "Check, weight; 2.35 kg",
          start: "2026-09-18T02:00:00.000Z",
          description: "line one\nline two",
        },
      ],
    });
    expect(ics).toContain("SUMMARY:Check\\, weight\\; 2.35 kg\r\n");
    expect(ics).toContain("DESCRIPTION:line one\\nline two\r\n");
  });

  it("round-trips through the ICS parser", () => {
    const ics = buildIcs({
      calendarName: "Feed",
      now,
      events: [
        {
          uid: "appointment-1@rabbittracker",
          summary: "Clover: Dental check",
          start: "2026-09-18T02:00:00.000Z",
          end: "2026-09-18T03:00:00.000Z",
        },
        {
          uid: "vaccination-1@rabbittracker",
          summary: "Clover: RHDV2 vaccine due",
          start: "2026-09-20",
          allDay: true,
        },
        {
          uid: "appointment-2@rabbittracker",
          summary: "Cancelled visit",
          start: "2026-09-21T02:00:00.000Z",
          cancelled: true,
        },
      ],
    });
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].summary).toBe("Clover: Dental check");
    expect(parsed[0].startAt).toBe("2026-09-18T02:00:00.000Z");
    expect(parsed[1].allDay).toBe(true);
    expect(parsed[1].startAt).toBe("2026-09-20T00:00:00.000Z");
    expect(parsed[2].cancelled).toBe(true);
  });
});

describe("buildFeedEvents", () => {
  it("maps an appointment with a follow-up", () => {
    const events = buildFeedEvents(
      source({
        appointments: [
          {
            id: 7,
            rabbitId: 1,
            title: "Dental check",
            clinic: "Happy Paws",
            vet: "Dr Chen",
            location: "12 Main St",
            scheduledAt: new Date("2026-09-18T02:00:00.000Z"),
            status: "scheduled",
            costCents: 12500,
            followUpAt: new Date("2026-09-25T02:00:00.000Z"),
            notes: "Bring chart",
          },
        ],
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: "appointment-7@rabbittracker",
      summary: "Clover: Dental check",
      location: "12 Main St",
      start: "2026-09-18T02:00:00.000Z",
      end: "2026-09-18T03:00:00.000Z",
    });
    expect(events[0].description).toContain("Cost: $125.00");
    expect(events[1].uid).toBe("appointment-followup-7@rabbittracker");
  });

  it("omits follow-ups for cancelled appointments and marks them cancelled", () => {
    const events = buildFeedEvents(
      source({
        appointments: [
          {
            id: 8,
            rabbitId: 1,
            title: "Check",
            clinic: "",
            vet: "",
            location: "",
            scheduledAt: new Date("2026-09-18T02:00:00.000Z"),
            status: "cancelled",
            costCents: null,
            followUpAt: new Date("2026-09-25T02:00:00.000Z"),
            notes: "",
          },
        ],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].cancelled).toBe(true);
  });

  it("adds an all-day event for a vaccination due date", () => {
    const events = buildFeedEvents(
      source({
        vaccinations: [
          { id: 3, rabbitId: 2, vaccine: "RHDV2", nextDueAt: "2026-09-20", vet: "Dr Chen", notes: "" },
          { id: 4, rabbitId: 2, vaccine: "Myxomatosis", nextDueAt: null, vet: "", notes: "" },
        ],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "vaccination-3@rabbittracker",
      summary: "Biscuit: RHDV2 vaccine due",
      start: "2026-09-20",
      allDay: true,
    });
  });

  it("computes care due dates from the last completion and interval", () => {
    const events = buildFeedEvents(
      source({
        tasks: [
          {
            id: 7,
            rabbitId: 1,
            label: "Nails",
            careKind: "nails",
            intervalDays: 42,
            recurrence: { kind: "interval", days: [], count: 1, intervalDays: 42 },
            lastCompletedAt: new Date("2026-07-20T00:00:00.000Z"),
          },
          {
            id: 8,
            rabbitId: 1,
            label: "Teeth",
            careKind: "teeth",
            intervalDays: 180,
            recurrence: { kind: "interval", days: [], count: 1, intervalDays: 180 },
            lastCompletedAt: null,
          },
        ],
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "care-7@rabbittracker",
      summary: "Clover: Nails due",
      start: "2026-08-31",
      allDay: true,
    });
  });

  it("includes health checks with the weight in the summary", () => {
    const events = buildFeedEvents(
      source({
        healthChecks: [
          {
            id: 11,
            rabbitId: 1,
            checkedAt: new Date("2026-09-12T08:00:00.000Z"),
            weightGrams: 2210,
            appetite: "normal",
            droppings: null,
            energy: null,
            bodyCondition: 3,
            notes: "Perked up",
          },
        ],
      }),
    );
    expect(events[0]).toMatchObject({
      uid: "check-11@rabbittracker",
      summary: "Clover: Health check — 2.21 kg",
      start: "2026-09-12T08:00:00.000Z",
      end: "2026-09-12T08:15:00.000Z",
    });
    expect(events[0].description).toContain("Condition: 3/5");
  });

  it("adds treatment start and end events", () => {
    const events = buildFeedEvents(
      source({
        treatments: [
          {
            id: 5,
            rabbitId: 1,
            medication: "Meloxicam",
            dose: "0.3 ml",
            frequency: "once daily",
            reason: "Pain",
            startDate: "2026-09-06",
            endDate: "2026-09-16",
            notes: "",
          },
        ],
      }),
    );
    expect(events.map((event) => event.uid)).toEqual([
      "treatment-start-5@rabbittracker",
      "treatment-end-5@rabbittracker",
    ]);
    expect(events[0].start).toBe("2026-09-06");
    expect(events[1].start).toBe("2026-09-16");
  });

  it("filters everything to one rabbit", () => {
    const events = buildFeedEvents(
      source({
        appointments: [
          {
            id: 1,
            rabbitId: 1,
            title: "Clover check",
            clinic: "",
            vet: "",
            location: "",
            scheduledAt: new Date("2026-09-18T02:00:00.000Z"),
            status: "scheduled",
            costCents: null,
            followUpAt: null,
            notes: "",
          },
          {
            id: 2,
            rabbitId: 2,
            title: "Biscuit check",
            clinic: "",
            vet: "",
            location: "",
            scheduledAt: new Date("2026-09-19T02:00:00.000Z"),
            status: "scheduled",
            costCents: null,
            followUpAt: null,
            notes: "",
          },
        ],
      }),
      2,
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Biscuit: Biscuit check");
  });
});
