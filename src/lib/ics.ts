// Client-safe iCalendar (.ics) generator for appointments.
// Compatible with Google Calendar, Outlook, Apple Calendar.

export type IcsInput = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  organizerEmail?: string | null;
  organizerName?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsDate(d: Date): string {
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

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(input: IcsInput): string {
  const start = new Date(input.startsAt);
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 60 * 60_000);
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ana//SalesAutomation//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@ana-sales`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.organizerEmail) {
    const name = input.organizerName ? `CN=${escapeText(input.organizerName)}:` : "";
    lines.push(`ORGANIZER;${name}mailto:${input.organizerEmail}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(input: IcsInput, filename?: string) {
  const ics = buildIcs(input);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `reuniao-${input.uid.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
