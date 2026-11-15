import { EVENTS, GROUP, TRIP, type EventType } from "@/data/trip";
import { clockList, clockRange, tripPhase, zonedNow, type Phase, type ZonedNow } from "./time";

// The pages read the trip through this file. The trip itself is src/data/trip.ts.

export type { EventType };

export type PublicEvent = {
  id: string;
  type: EventType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  description: string;
  venue: string;
  address: string;
  par: number | null;
  partySize: number | null;
  group: string | null;
  reservationNote: string;
  /** Tee times our group is in. `ours` marks the players who are in our group. */
  teeTimes: { time: string; players: { name: string; ours: boolean }[]; note: string }[];
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const events: PublicEvent[] = EVENTS.map((e) => ({
  id: `${e.date}-${slugify(e.title)}`,
  type: e.type,
  date: e.date,
  startTime: e.startTime ?? null,
  endTime: e.endTime ?? null,
  title: e.title,
  description: e.description ?? "",
  venue: e.venue ?? "",
  address: e.address ?? "",
  par: e.par ?? null,
  partySize: e.partySize ?? null,
  group: e.group ?? null,
  reservationNote: e.reservationNote ?? "",
  teeTimes: (e.teeTimes ?? []).map((t) => ({
    time: t.time,
    players: (t.players ?? []).map((name) => ({ name, ours: GROUP.includes(name) })),
    note: t.note ?? "",
  })),
})).sort(
  (a, b) =>
    a.date.localeCompare(b.date) ||
    (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
    a.title.localeCompare(b.title),
);

const data = { trip: TRIP, events, lodging: TRIP.lodging };

export type PublicTrip = typeof data;

/** The trip at this address, or null. */
export async function getTrip(slug: string): Promise<PublicTrip | null> {
  return slug === TRIP.slug ? data : null;
}

/** "Now" in the trip's timezone, and whether that is before, during or after the trip. */
export async function getTripNow(trip: {
  startDate: string;
  endDate: string;
  timezone: string;
}): Promise<{ now: ZonedNow; phase: Phase }> {
  const now = zonedNow(trip.timezone);
  return { now, phase: tripPhase(now, trip) };
}

/** Rounds in playing order, as "Round 2 of 4" needs them. */
export function roundNumbers(all: PublicEvent[]): Record<string, { number: number; total: number; par: number }> {
  const golf = all.filter((e) => e.type === "golf" && e.par !== null);
  return Object.fromEntries(golf.map((e, i) => [e.id, { number: i + 1, total: golf.length, par: e.par! }]));
}

// ---- Small helpers shared by the pages ----

/** When an event is, as text: our own tee times for a round, otherwise its start and end. */
export function eventTimes(e: Pick<PublicEvent, "startTime" | "endTime" | "teeTimes">): string {
  if (e.teeTimes.length > 0) return clockList(e.teeTimes.map((t) => t.time));
  return e.startTime ? clockRange(e.startTime, e.endTime) : "";
}

/** The moment an event stops being "upcoming": its end, or a sensible default length. */
export function eventEnd(e: Pick<PublicEvent, "type" | "startTime" | "endTime">): string {
  if (!e.startTime) return "23:59";
  const [h, m] = (e.endTime ?? e.startTime).split(":").map(Number);
  // A golf window is the span of tee times; the last group needs time to finish.
  const extra = e.type === "golf" ? 270 : e.endTime ? 0 : 90;
  const total = Math.min(23 * 60 + 59, h * 60 + m + extra);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function isPast(e: PublicEvent, now: ZonedNow): boolean {
  return e.date < now.date || (e.date === now.date && eventEnd(e) < now.time);
}

export function isUnderway(e: PublicEvent, now: ZonedNow): boolean {
  return (
    e.date === now.date && !!e.startTime && e.startTime <= now.time && eventEnd(e) >= now.time
  );
}

export { directionsUrl } from "./links";
