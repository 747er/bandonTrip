import { EVENTS, PEOPLE, ROOMS, TEE_SHEET, TRIP, type EventType } from "@/data/trip";
import { clock, clockList, tripPhase, zonedNow, type Phase, type ZonedNow } from "./time";

// The trip as one person sees it. The trip itself is src/data/trip.ts; who is looking
// is decided in src/lib/viewer.ts. Everything here is safe to use in the browser.

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
  /** The viewer's own tee time for a round */
  teeTime: string | null;
  /** Tee times shown to the viewer. `ours` marks the viewer, or all of our six for one of them. */
  teeTimes: { time: string; players: { name: string; ours: boolean }[]; note: string }[];
};

export type Viewer = {
  /** Address-safe id, kept in the cookie */
  id: string;
  name: string;
  firstName: string;
  /** One of our six: sees meals and outings as well as golf */
  core: boolean;
  room: string;
  /** Which pin on the maps the room is at */
  roomPlace: string;
  roommates: string[];
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const personId = (key: string) => slugify(key);

/** Everyone who can be chosen on the front door, by first name. */
export const ROSTER = PEOPLE.map((p) => ({ id: personId(p.key), name: p.name, room: ROOMS[p.room].name })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function viewerFor(id: string | null | undefined): Viewer | null {
  const person = PEOPLE.find((p) => personId(p.key) === id);
  if (!person) return null;
  return {
    id: personId(person.key),
    name: person.name,
    firstName: person.name.split(" ")[0],
    core: !!person.core,
    room: ROOMS[person.room].name,
    roomPlace: ROOMS[person.room].place,
    roommates: PEOPLE.filter((p) => p.room === person.room && p.key !== person.key).map((p) => p.name),
  };
}

const nameOf = (key: string) => PEOPLE.find((p) => p.key === key)?.name ?? key;
const isCore = (key: string) => !!PEOPLE.find((p) => p.key === key)?.core;

/**
 * The trip for one viewer. Our six get everything, with each round's tee times for all
 * six. Anyone else gets the rounds only, each with their own tee time and foursome.
 * With no viewer, the rounds are shown without pairings.
 */
export function buildTrip(viewer: Viewer | null) {
  const me = PEOPLE.find((p) => personId(p.key) === viewer?.id);
  const events: PublicEvent[] = EVENTS.filter((e) => e.type === "golf" || viewer?.core)
    .map((e) => {
      const sheet = e.type === "golf" ? (TEE_SHEET[e.title] ?? []) : [];
      const mine = me ? sheet.find(([, players]) => players.includes(me.key)) : undefined;
      // Rows worth showing: the viewer's own, plus the rest of our six for one of them.
      const rows = sheet.filter(([, players]) => (me ? players.includes(me.key) || (me.core && players.some(isCore)) : false));
      return {
        id: `${e.date}-${slugify(e.title)}`,
        type: e.type,
        date: e.date,
        // A round starts, for the viewer, when they tee off.
        startTime: mine?.[0] ?? e.startTime ?? null,
        endTime: mine ? null : (e.endTime ?? null),
        title: e.title,
        description: e.description ?? "",
        venue: e.venue ?? "",
        address: e.address ?? "",
        par: e.par ?? null,
        partySize: e.partySize ?? null,
        group: e.group ?? null,
        reservationNote: e.reservationNote ?? "",
        teeTime: mine?.[0] ?? null,
        teeTimes: rows.map(([time, players]) => ({
          time,
          players: players.map((key) => ({ name: nameOf(key), ours: me?.core ? isCore(key) : key === me?.key })),
          note: "",
        })),
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title),
    );

  return { trip: TRIP, events, viewer };
}

export type PublicTrip = ReturnType<typeof buildTrip>;

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

/** When an event is, as text: the viewer's own tee time for a round, otherwise when it starts. End times are never shown. */
export function eventTimes(e: Pick<PublicEvent, "startTime" | "teeTime" | "teeTimes">): string {
  if (e.teeTime) return clock(e.teeTime);
  if (e.teeTimes.length > 0) return clockList(e.teeTimes.map((t) => t.time));
  return e.startTime ? clock(e.startTime) : "";
}

/** "Tee time" for a round the viewer has a time in, "Tee times" for a window. */
export const teeLabel = (e: Pick<PublicEvent, "teeTime">) => (e.teeTime ? "Tee time" : "Tee times");

/** The moment an event stops being "upcoming": its end, or a sensible default length. */
export function eventEnd(e: Pick<PublicEvent, "type" | "startTime" | "endTime">): string {
  if (!e.startTime) return "23:59";
  const [h, m] = (e.endTime ?? e.startTime).split(":").map(Number);
  // A round takes a while after the tee time.
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
