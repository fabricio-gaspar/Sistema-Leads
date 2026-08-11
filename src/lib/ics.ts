export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  organizerEmail?: string | null;
  organizerName?: string | null;
};

export function generateIcs(event: IcsEvent): string {
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lovable//Sales Automation//PT",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startsAt)}`,
  ];

  if (event.endsAt) {
    lines.push(`DTEND:${formatDate(event.endsAt)}`);
  }
  
  lines.push(`SUMMARY:${event.title}`);
  
  if (event.description) {
    lines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`);
  }
  
  if (event.location) {
    lines.push(`LOCATION:${event.location}`);
  }

  if (event.organizerEmail) {
    const organizer = event.organizerName 
      ? `CN=${event.organizerName}:MAILTO:${event.organizerEmail}`
      : `MAILTO:${event.organizerEmail}`;
    lines.push(`ORGANIZER;${organizer}`);
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}
