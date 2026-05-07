export interface ICalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
}

const PRODID = "-//Event Board//Local Event Board//EN";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return chunks.join("\r\n");
}

function buildVEvent(event: ICalendarEvent, dtstamp: string): string[] {
  return [
    "BEGIN:VEVENT",
    foldLine(`UID:${event.id}@event-board.local`),
    foldLine(`DTSTAMP:${dtstamp}`),
    foldLine(`DTSTART:${toUtcStamp(event.startDate)}`),
    foldLine(`DTEND:${toUtcStamp(event.endDate)}`),
    foldLine(`SUMMARY:${escapeText(event.title)}`),
    foldLine(`DESCRIPTION:${escapeText(event.description)}`),
    foldLine(`LOCATION:${escapeText(event.location)}`),
    "END:VEVENT",
  ];
}

export function formatIcsCalendar(
  events: ICalendarEvent[],
  now: Date = new Date(),
): string {
  const dtstamp = toUtcStamp(now.toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    foldLine(`PRODID:${PRODID}`),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(...buildVEvent(event, dtstamp));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function formatGoogleCalendarUrl(event: ICalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.startDate)}/${toUtcStamp(event.endDate)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
