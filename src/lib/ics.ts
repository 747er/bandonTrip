import { addDays, zonedToUtc } from "./time";
import { eventEnd, type PublicEvent } from "./trip";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

// Lines longer than 75 octets must be folded.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildCalendar(
  trip: { title: string; timezone: string; slug: string },
  events: PublicEvent[],
  origin: string,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BandonTrip//Trip Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(trip.title)}`,
  ];
  const now = stamp(new Date());
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@bandontrip.com`, `DTSTAMP:${now}`);
    if (e.startTime) {
      lines.push(
        `DTSTART:${stamp(zonedToUtc(e.date, e.startTime, trip.timezone))}`,
        `DTEND:${stamp(zonedToUtc(e.date, eventEnd(e), trip.timezone))}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`,
      );
    }
    const details = [
      e.description,
      e.partySize ? `Party of ${e.partySize}` : "",
      e.reservationNote,
      `${origin}/t/${trip.slug}/schedule`,
    ].filter(Boolean);
    lines.push(
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape([e.venue, e.address].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${escape(details.join("\n"))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
