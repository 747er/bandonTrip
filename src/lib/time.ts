// Dates are stored as "YYYY-MM-DD" and times as "HH:MM", both as wall-clock values in
// the trip's timezone. These helpers keep that arithmetic away from the server's zone.

export type Phase = "before" | "during" | "after";

export type ZonedNow = {
  /** "YYYY-MM-DD" in the trip's timezone */
  date: string;
  /** "HH:MM" in the trip's timezone */
  time: string;
  instant: Date;
};

export function zonedNow(timezone: string, instant = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    instant,
  };
}

/** The UTC instant of a wall-clock date and time in a timezone. */
export function zonedToUtc(date: string, time: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Find the zone's offset at the guessed instant, then correct once more for DST edges.
  const offsetAt = (ms: number) => {
    const z = zonedNow(timezone, new Date(ms));
    const [zy, zm, zd] = z.date.split("-").map(Number);
    const [zh, zmin] = z.time.split(":").map(Number);
    return Date.UTC(zy, zm - 1, zd, zh, zmin) - ms;
  };
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  return new Date(utc);
}

export function tripPhase(
  now: ZonedNow,
  trip: { startDate: string; endDate: string },
): Phase {
  if (now.date < trip.startDate) return "before";
  if (now.date > trip.endDate) return "after";
  return "during";
}

const asUtc = (date: string) => new Date(`${date}T12:00:00Z`);

export function addDays(date: string, days: number): string {
  const d = asUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((asUtc(b).getTime() - asUtc(a).getTime()) / 86_400_000);
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(
    asUtc(date),
  );

export const weekday = (date: string) => fmt(date, { weekday: "long" });
export const weekdayShort = (date: string) => fmt(date, { weekday: "short" });
export const monthDay = (date: string) => fmt(date, { month: "long", day: "numeric" });
export const monthDayShort = (date: string) =>
  fmt(date, { month: "short", day: "numeric" });
export const dayOfMonth = (date: string) => fmt(date, { day: "numeric" });

/** "November 19–22, 2026", or "Nov 30 – Dec 2, 2026" across months. */
export function dateRange(start: string, end: string): string {
  const year = fmt(end, { year: "numeric" });
  if (start === end) return `${monthDay(start)}, ${year}`;
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${monthDay(start)}–${dayOfMonth(end)}, ${year}`;
  }
  return `${monthDayShort(start)} – ${monthDayShort(end)}, ${year}`;
}

/** "17:30" → "5:30 PM" */
export function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const meridiem = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/** "10:10–11:10 AM", "11:30 AM – 12:40 PM", or a single time. */
export function clockRange(start: string, end?: string | null): string {
  if (!end || end === start) return clock(start);
  const a = clock(start);
  const b = clock(end);
  if (a.slice(-2) === b.slice(-2)) return `${a.slice(0, -3)}–${b}`;
  return `${a} – ${b}`;
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve",
];
export const numberWord = (n: number) => WORDS[n] ?? String(n);

const ORDINALS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const dayCount = (n: number) => ORDINALS[n] ?? String(n);
