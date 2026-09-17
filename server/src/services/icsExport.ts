import { formatWeight } from "../../../shared/health.ts";
import { recurrenceLabel, type Recurrence } from "../../../shared/recurrence.ts";

export type FeedEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end?: string | null;
  allDay?: boolean;
  cancelled?: boolean;
};

export type FeedSource = {
  rabbits: { id: number; name: string }[];
  appointments: {
    id: number;
    rabbitId: number;
    title: string;
    clinic: string;
    vet: string;
    location: string;
    scheduledAt: Date;
    status: string;
    costCents: number | null;
    followUpAt: Date | null;
    notes: string;
  }[];
  vaccinations: {
    id: number;
    rabbitId: number;
    vaccine: string;
    nextDueAt: string | null;
    vet: string;
    notes: string;
  }[];
  tasks: {
    id: number;
    rabbitId: number;
    label: string;
    careKind: string | null;
    recurrence: Recurrence;
    intervalDays: number;
    lastCompletedAt: Date | null;
  }[];
  healthChecks: {
    id: number;
    rabbitId: number;
    checkedAt: Date;
    weightGrams: number | null;
    appetite: string | null;
    droppings: string | null;
    energy: string | null;
    bodyCondition: number | null;
    notes: string;
  }[];
  treatments: {
    id: number;
    rabbitId: number;
    medication: string;
    dose: string;
    frequency: string;
    recurrence?: Recurrence;
    reason: string;
    startDate: string;
    endDate: string | null;
    notes: string;
  }[];
};

export function buildFeedEvents(source: FeedSource, rabbitId?: number): FeedEvent[] {
  const names = new Map(source.rabbits.map((rabbit) => [rabbit.id, rabbit.name]));
  const include = (id: number) => rabbitId === undefined || id === rabbitId;
  const name = (id: number) => names.get(id) ?? "Bunny";
  const events: FeedEvent[] = [];

  for (const appointment of source.appointments) {
    if (!include(appointment.rabbitId)) continue;
    events.push({
      uid: `appointment-${appointment.id}@rabbittracker`,
      summary: `${name(appointment.rabbitId)}: ${appointment.title}`,
      description: joinLines([
        appointment.vet,
        appointment.clinic,
        appointment.costCents !== null ? `Cost: $${(appointment.costCents / 100).toFixed(2)}` : "",
        appointment.notes,
      ]),
      location: appointment.location || appointment.clinic,
      start: appointment.scheduledAt.toISOString(),
      end: new Date(appointment.scheduledAt.getTime() + 60 * 60_000).toISOString(),
      cancelled: appointment.status === "cancelled",
    });
    if (appointment.status === "scheduled" && appointment.followUpAt) {
      events.push({
        uid: `appointment-followup-${appointment.id}@rabbittracker`,
        summary: `${name(appointment.rabbitId)}: Follow-up — ${appointment.title}`,
        description: joinLines([appointment.clinic, appointment.notes]),
        start: appointment.followUpAt.toISOString(),
        end: new Date(appointment.followUpAt.getTime() + 30 * 60_000).toISOString(),
      });
    }
  }

  for (const vaccination of source.vaccinations) {
    if (!include(vaccination.rabbitId) || !vaccination.nextDueAt) continue;
    events.push({
      uid: `vaccination-${vaccination.id}@rabbittracker`,
      summary: `${name(vaccination.rabbitId)}: ${vaccination.vaccine} vaccine due`,
      description: joinLines([vaccination.vet, vaccination.notes]),
      start: vaccination.nextDueAt,
      allDay: true,
    });
  }

  for (const task of source.tasks) {
    if (!task.careKind || !include(task.rabbitId) || !task.lastCompletedAt) continue;
    events.push({
      uid: `care-${task.id}@rabbittracker`,
      summary: `${name(task.rabbitId)}: ${task.label} due`,
      description: recurrenceLabel(task.recurrence),
      start: addDays(task.lastCompletedAt.toISOString(), task.intervalDays),
      allDay: true,
    });
  }

  for (const check of source.healthChecks) {
    if (!include(check.rabbitId)) continue;
    const weight = check.weightGrams !== null ? formatWeight(check.weightGrams) : "";
    events.push({
      uid: `check-${check.id}@rabbittracker`,
      summary: `${name(check.rabbitId)}: Health check${weight ? ` — ${weight}` : ""}`,
      description: joinLines([
        check.appetite ? `Appetite: ${check.appetite}` : "",
        check.droppings ? `Droppings: ${check.droppings}` : "",
        check.energy ? `Energy: ${check.energy}` : "",
        check.bodyCondition ? `Condition: ${check.bodyCondition}/5` : "",
        check.notes,
      ]),
      start: check.checkedAt.toISOString(),
      end: new Date(check.checkedAt.getTime() + 15 * 60_000).toISOString(),
    });
  }

  for (const treatment of source.treatments) {
    if (!include(treatment.rabbitId)) continue;
    const repeat = treatment.recurrence ? recurrenceLabel(treatment.recurrence) : "";
    events.push({
      uid: `treatment-start-${treatment.id}@rabbittracker`,
      summary: `${name(treatment.rabbitId)}: ${treatment.medication} started`,
      description: joinLines([
        treatment.dose,
        treatment.frequency,
        repeat,
        treatment.reason,
        treatment.notes,
      ]),
      start: treatment.startDate,
      allDay: true,
    });
    if (treatment.endDate) {
      events.push({
        uid: `treatment-end-${treatment.id}@rabbittracker`,
        summary: `${name(treatment.rabbitId)}: ${treatment.medication} ends`,
        description: joinLines([treatment.dose, treatment.frequency, repeat]),
        start: treatment.endDate,
        allDay: true,
      });
    }
  }

  return events;
}

export function buildIcs(options: {
  calendarName: string;
  events: FeedEvent[];
  now: Date;
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RabbitTracker//RabbitTracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
  ];
  const stamp = toIcsTimestamp(options.now.toISOString());

  for (const event of options.events) {
    lines.push("BEGIN:VEVENT", `UID:${escapeIcsText(event.uid)}`, `DTSTAMP:${stamp}`);
    if (event.allDay) {
      const end = event.end ? event.end : addDays(event.start, 1);
      lines.push(
        `DTSTART;VALUE=DATE:${toIcsDate(event.start)}`,
        `DTEND;VALUE=DATE:${toIcsDate(end)}`,
      );
    } else {
      lines.push(`DTSTART:${toIcsTimestamp(event.start)}`);
      if (event.end) lines.push(`DTEND:${toIcsTimestamp(event.end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push(event.cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n");
}

export function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > 75) {
      parts.push(current);
      current = ` ${char}`;
      currentBytes = 1 + charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

function toIcsTimestamp(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function toIcsDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll("-", "");
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function joinLines(parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join("\n");
}
