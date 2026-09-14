export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  location: string;
  description: string;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  cancelled: boolean;
};

type IcsProperty = {
  value: string;
  params: Record<string, string>;
};

export function parseIcs(text: string): ParsedIcsEvent[] {
  const events: ParsedIcsEvent[] = [];
  let current: Record<string, IcsProperty> | null = null;

  for (const line of unfoldLines(text)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const event = toEvent(current);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const property = parseProperty(line);
    if (property) current[property.name] = { value: property.value, params: property.params };
  }

  return events;
}

function unfoldLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

function parseProperty(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const equals = part.indexOf("=");
    if (equals === -1) continue;
    params[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function toEvent(props: Record<string, IcsProperty>): ParsedIcsEvent | null {
  const uid = props.UID?.value;
  if (!uid) return null;
  const start = props.DTSTART;
  const end = props.DTEND;
  const allDay = start ? start.params.VALUE === "DATE" || /^\d{8}$/.test(start.value) : false;
  return {
    uid,
    summary: unescapeText(props.SUMMARY?.value ?? ""),
    location: unescapeText(props.LOCATION?.value ?? ""),
    description: unescapeText(props.DESCRIPTION?.value ?? ""),
    startAt: start ? parseIcsDate(start.value, start.params.TZID) : null,
    endAt: end ? parseIcsDate(end.value, end.params.TZID) : null,
    allDay,
    cancelled: (props.STATUS?.value ?? "").toUpperCase() === "CANCELLED",
  };
}

function parseIcsDate(value: string, tzid: string | undefined): string | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
    ).toISOString();
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!dateTime) return null;
  const parts = {
    year: Number(dateTime[1]),
    month: Number(dateTime[2]),
    day: Number(dateTime[3]),
    hour: Number(dateTime[4]),
    minute: Number(dateTime[5]),
    second: Number(dateTime[6]),
  };
  const utcMillis = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  if (dateTime[7] === "Z" || !tzid) return new Date(utcMillis).toISOString();
  const zoned = zonedTimeToUtc(parts, tzid);
  return new Date(zoned ?? utcMillis).toISOString();
}

function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string,
): number | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const utcGuess = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const formatted = formatter.formatToParts(new Date(utcGuess));
    const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
    const offset = asUtc - utcGuess;
    return utcGuess - offset;
  } catch {
    return null;
  }
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_match, char: string) => {
    if (char === "n" || char === "N") return "\n";
    return char;
  });
}
