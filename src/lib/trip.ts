import "server-only";
import { cache } from "react";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { EventType } from "@/db/schema";
import { getPreviewAt } from "./auth";
import { tripPhase, zonedNow, zonedToUtc, type Phase, type ZonedNow } from "./time";

// Everything on public pages comes through this file. Queries name their columns so
// organizer-only fields (private_phone, private_note, …) can't leak by accident.

export type PublicPerson = {
  id: string;
  name: string;
  hometown: string;
  caddie: string;
  lodgingId: string | null;
};

export type Audience =
  | { kind: "everyone" }
  | { kind: "group"; name: string; ids: string[] }
  | { kind: "people"; ids: string[] };

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
  partySize: number | null;
  reservationNote: string;
  audience: Audience;
  teeTimes: { id: string; time: string; note: string; playerIds: string[] }[];
};

export type PublicTrip = Awaited<ReturnType<typeof loadTrip>> & {};

async function loadTrip(slug: string) {
  const db = await getDb();
  const [trip] = await db
    .select({
      id: s.trips.id,
      slug: s.trips.slug,
      title: s.trips.title,
      location: s.trips.location,
      tagline: s.trips.tagline,
      startDate: s.trips.startDate,
      endDate: s.trips.endDate,
      timezone: s.trips.timezone,
      visibility: s.trips.visibility,
      latitude: s.trips.latitude,
      longitude: s.trips.longitude,
      heroImageUrl: s.trips.heroImageUrl,
      heroImageCredit: s.trips.heroImageCredit,
    })
    .from(s.trips)
    .where(eq(s.trips.slug, slug));
  if (!trip) return null;

  const [people, lodgings, groups, eventRows, rounds, updates] = await Promise.all([
    db
      .select({
        id: s.participants.id,
        name: s.participants.name,
        hometown: s.participants.hometown,
        caddie: s.participants.caddie,
        lodgingId: s.participants.lodgingId,
      })
      .from(s.participants)
      .where(eq(s.participants.tripId, trip.id))
      .orderBy(asc(s.participants.sortOrder), asc(s.participants.name)),
    db
      .select({ id: s.lodgings.id, name: s.lodgings.name, detail: s.lodgings.detail })
      .from(s.lodgings)
      .where(eq(s.lodgings.tripId, trip.id))
      .orderBy(asc(s.lodgings.sortOrder), asc(s.lodgings.name)),
    db
      .select({ id: s.groups.id, name: s.groups.name, description: s.groups.description })
      .from(s.groups)
      .where(eq(s.groups.tripId, trip.id))
      .orderBy(asc(s.groups.sortOrder), asc(s.groups.name)),
    db
      .select({
        id: s.events.id,
        type: s.events.type,
        date: s.events.date,
        startTime: s.events.startTime,
        endTime: s.events.endTime,
        title: s.events.title,
        description: s.events.description,
        venue: s.events.venue,
        address: s.events.address,
        groupId: s.events.groupId,
        partySize: s.events.partySize,
        reservationNote: s.events.reservationNote,
      })
      .from(s.events)
      .where(eq(s.events.tripId, trip.id))
      .orderBy(asc(s.events.date), asc(s.events.startTime), asc(s.events.title)),
    db
      .select()
      .from(s.rounds)
      .where(eq(s.rounds.tripId, trip.id))
      .orderBy(asc(s.rounds.date), asc(s.rounds.courseName)),
    db
      .select({ id: s.updates.id, body: s.updates.body, createdAt: s.updates.createdAt })
      .from(s.updates)
      .where(eq(s.updates.tripId, trip.id))
      .orderBy(desc(s.updates.createdAt)),
  ]);

  const groupIds = groups.map((g) => g.id);
  const eventIds = eventRows.map((e) => e.id);
  const roundIds = rounds.map((r) => r.id);

  const [members, attendees, teeTimes, scores] = await Promise.all([
    groupIds.length
      ? db.select().from(s.groupMembers).where(inArray(s.groupMembers.groupId, groupIds))
      : [],
    eventIds.length
      ? db.select().from(s.eventAttendees).where(inArray(s.eventAttendees.eventId, eventIds))
      : [],
    eventIds.length
      ? db
          .select()
          .from(s.teeTimes)
          .where(inArray(s.teeTimes.eventId, eventIds))
          .orderBy(asc(s.teeTimes.time))
      : [],
    roundIds.length
      ? db
          .select({
            roundId: s.scores.roundId,
            participantId: s.scores.participantId,
            gross: s.scores.gross,
          })
          .from(s.scores)
          .where(inArray(s.scores.roundId, roundIds))
      : [],
  ]);

  const teeTimeIds = teeTimes.map((t) => t.id);
  const players = teeTimeIds.length
    ? await db
        .select()
        .from(s.teeTimePlayers)
        .where(inArray(s.teeTimePlayers.teeTimeId, teeTimeIds))
    : [];

  const order = new Map(people.map((p, i) => [p.id, i]));
  const sortIds = (ids: string[]) =>
    ids.filter((id) => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);

  const groupsWithMembers = groups.map((g) => ({
    ...g,
    memberIds: sortIds(members.filter((m) => m.groupId === g.id).map((m) => m.participantId)),
  }));

  const events: PublicEvent[] = eventRows.map(({ groupId, ...e }) => {
    const explicit = attendees.filter((a) => a.eventId === e.id).map((a) => a.participantId);
    const group = groupsWithMembers.find((g) => g.id === groupId);
    const audience: Audience = explicit.length
      ? { kind: "people", ids: sortIds(explicit) }
      : group
        ? { kind: "group", name: group.name, ids: group.memberIds }
        : { kind: "everyone" };
    return {
      ...e,
      audience,
      teeTimes: teeTimes
        .filter((t) => t.eventId === e.id)
        .map((t) => ({
          id: t.id,
          time: t.time,
          note: t.note,
          playerIds: sortIds(
            players.filter((p) => p.teeTimeId === t.id).map((p) => p.participantId),
          ),
        })),
    };
  });

  return { trip, people, lodgings, groups: groupsWithMembers, events, rounds, scores, updates };
}

export const getTrip = cache(loadTrip);

/** "Now" for a trip, honoring an organizer's preview time when one is set. */
export const getTripNow = cache(
  async (
    trip: { startDate: string; endDate: string; timezone: string },
  ): Promise<{ now: ZonedNow; phase: Phase; preview: boolean }> => {
    const previewAt = await getPreviewAt();
    if (previewAt) {
      const [date, time] = previewAt.split("T");
      const now = { date, time, instant: zonedToUtc(date, time, trip.timezone) };
      return { now, phase: tripPhase(now, trip), preview: true };
    }
    const now = zonedNow(trip.timezone);
    return { now, phase: tripPhase(now, trip), preview: false };
  },
);

/** The most recent public trip, used for the bandontrip.com front door. */
export async function getFeaturedTripSlug(): Promise<string | null> {
  const db = await getDb();
  const [trip] = await db
    .select({ slug: s.trips.slug })
    .from(s.trips)
    .where(eq(s.trips.visibility, "public"))
    .orderBy(desc(s.trips.startDate))
    .limit(1);
  return trip?.slug ?? null;
}

// ---- Small helpers shared by the public pages ----

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
