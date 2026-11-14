"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { EVENT_TYPES, type EventType } from "@/db/schema";
import {
  endSession,
  requireOrganizer,
  requireTrip,
  setPreviewAt,
  startSession,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

// Every action below starts with requireTrip(), which checks the session cookie and that
// the signed-in organizer owns the trip. Child rows are always matched on trip_id too, so
// an id from another trip can't be edited by guessing it.

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optionalTime = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? v : null);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const intOrNull = (v: string) => (v !== "" && Number.isInteger(Number(v)) ? Number(v) : null);

function done(tripId: string) {
  revalidatePath("/", "layout");
  void tripId;
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
const randomSuffix = () => randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

// ---------- Session ----------

export async function login(_prev: { error: string } | null, fd: FormData) {
  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const db = await getDb();
  const [organizer] = await db.select().from(s.organizers).where(eq(s.organizers.email, email));
  // Slow every attempt a little so guessing is expensive.
  await new Promise((r) => setTimeout(r, 400));
  if (!organizer || !verifyPassword(password, organizer.passwordHash)) {
    return { error: "That email and password don't match an organizer account." };
  }
  await startSession(organizer.id);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

export async function setPreview(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const at = text(fd, "at");
  await setPreviewAt(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) ? at : null);
  if (at) redirect(`/t/${trip.slug}`);
  done(trip.id);
}

// ---------- Trips ----------

export async function createTrip(fd: FormData) {
  const organizer = await requireOrganizer();
  const title = text(fd, "title");
  const startDate = text(fd, "startDate");
  const endDate = text(fd, "endDate");
  if (!title || !isDate(startDate) || !isDate(endDate) || endDate < startDate) return;
  const db = await getDb();
  const [trip] = await db
    .insert(s.trips)
    .values({
      ownerId: organizer.id,
      title,
      startDate,
      endDate,
      location: text(fd, "location"),
      visibility: "unlisted",
      slug: `${slugify(title) || "trip"}-${randomSuffix()}`,
    })
    .returning();
  redirect(`/admin/trips/${trip.id}`);
}

export async function updateTrip(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const title = text(fd, "title");
  const startDate = text(fd, "startDate");
  const endDate = text(fd, "endDate");
  if (!title || !isDate(startDate) || !isDate(endDate) || endDate < startDate) return;
  const visibility = text(fd, "visibility") === "public" ? "public" : "unlisted";
  const heroImageUrl = text(fd, "heroImageUrl");
  const db = await getDb();
  await db
    .update(s.trips)
    .set({
      title,
      startDate,
      endDate,
      location: text(fd, "location"),
      tagline: text(fd, "tagline"),
      timezone: text(fd, "timezone") || "America/Los_Angeles",
      visibility,
      heroImageUrl: /^https:\/\//.test(heroImageUrl) ? heroImageUrl : null,
      heroImageCredit: text(fd, "heroImageCredit") || null,
    })
    .where(eq(s.trips.id, trip.id));
  done(trip.id);
}

/** Replaces the trip's link with a new hard-to-guess one. The old link stops working. */
export async function newShareLink(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .update(s.trips)
    .set({ slug: `${slugify(trip.title) || "trip"}-${randomSuffix()}` })
    .where(eq(s.trips.id, trip.id));
  done(trip.id);
}

export async function postUpdate(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const body = text(fd, "body");
  if (!body) return;
  const db = await getDb();
  await db.insert(s.updates).values({ tripId: trip.id, body });
  done(trip.id);
}

export async function deleteUpdate(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.updates)
    .where(and(eq(s.updates.id, text(fd, "id")), eq(s.updates.tripId, trip.id)));
  done(trip.id);
}

// ---------- Helpers for people pickers ----------

async function tripPeopleIds(tripId: string, ids: string[]): Promise<string[]> {
  const wanted = ids.filter(isUuid);
  if (wanted.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({ id: s.participants.id })
    .from(s.participants)
    .where(and(eq(s.participants.tripId, tripId), inArray(s.participants.id, wanted)));
  return rows.map((r) => r.id);
}

async function tripGroupId(tripId: string, id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [g] = await db
    .select({ id: s.groups.id })
    .from(s.groups)
    .where(and(eq(s.groups.id, id), eq(s.groups.tripId, tripId)));
  return g?.id ?? null;
}

// ---------- Events ----------

export async function saveEvent(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const eventId = text(fd, "eventId");
  const title = text(fd, "title");
  const date = text(fd, "date");
  if (!title || !isDate(date)) return;
  const type = (EVENT_TYPES as readonly string[]).includes(text(fd, "type"))
    ? (text(fd, "type") as EventType)
    : "custom";
  const audience = text(fd, "audience"); // "everyone" | "people" | group id
  const values = {
    type,
    date,
    startTime: optionalTime(text(fd, "startTime")),
    endTime: optionalTime(text(fd, "endTime")),
    title,
    description: text(fd, "description"),
    venue: text(fd, "venue"),
    address: text(fd, "address"),
    groupId: await tripGroupId(trip.id, audience),
    partySize: intOrNull(text(fd, "partySize")),
    reservationNote: text(fd, "reservationNote"),
    privateNote: text(fd, "privateNote"),
  };
  const db = await getDb();

  let id = eventId;
  if (eventId) {
    await db
      .update(s.events)
      .set(values)
      .where(and(eq(s.events.id, eventId), eq(s.events.tripId, trip.id)));
  } else {
    const [created] = await db
      .insert(s.events)
      .values({ ...values, tripId: trip.id })
      .returning();
    id = created.id;
    // A new golf event gets a round on the scoreboard straight away.
    if (type === "golf") {
      await db.insert(s.rounds).values({
        tripId: trip.id,
        eventId: id,
        courseName: values.venue || title,
        par: intOrNull(text(fd, "par")) ?? 72,
        date,
      });
    }
  }

  if (fd.has("audience")) {
    const [owned] = await db
      .select({ id: s.events.id })
      .from(s.events)
      .where(and(eq(s.events.id, id), eq(s.events.tripId, trip.id)));
    if (owned) {
      await db.delete(s.eventAttendees).where(eq(s.eventAttendees.eventId, id));
      if (audience === "people") {
        const ids = await tripPeopleIds(trip.id, fd.getAll("attendee").map(String));
        if (ids.length) {
          await db
            .insert(s.eventAttendees)
            .values(ids.map((participantId) => ({ eventId: id, participantId })));
        }
      }
    }
  }

  done(trip.id);
  if (!eventId) redirect(`/admin/trips/${trip.id}/schedule/${id}`);
}

export async function deleteEvent(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.events)
    .where(and(eq(s.events.id, text(fd, "eventId")), eq(s.events.tripId, trip.id)));
  done(trip.id);
  redirect(`/admin/trips/${trip.id}/schedule`);
}

export async function saveTeeTime(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const eventId = text(fd, "eventId");
  const time = optionalTime(text(fd, "time"));
  if (!time) return;
  const db = await getDb();
  const [event] = await db
    .select({ id: s.events.id })
    .from(s.events)
    .where(and(eq(s.events.id, eventId), eq(s.events.tripId, trip.id)));
  if (!event) return;

  let teeTimeId = text(fd, "teeTimeId");
  const values = { time, note: text(fd, "note") };
  if (teeTimeId) {
    await db
      .update(s.teeTimes)
      .set(values)
      .where(and(eq(s.teeTimes.id, teeTimeId), eq(s.teeTimes.eventId, event.id)));
  } else {
    const [created] = await db
      .insert(s.teeTimes)
      .values({ ...values, eventId: event.id })
      .returning();
    teeTimeId = created.id;
  }
  const [owned] = await db
    .select({ id: s.teeTimes.id })
    .from(s.teeTimes)
    .where(and(eq(s.teeTimes.id, teeTimeId), eq(s.teeTimes.eventId, event.id)));
  if (owned) {
    const ids = await tripPeopleIds(trip.id, fd.getAll("player").map(String));
    await db.delete(s.teeTimePlayers).where(eq(s.teeTimePlayers.teeTimeId, teeTimeId));
    if (ids.length) {
      await db
        .insert(s.teeTimePlayers)
        .values(ids.map((participantId) => ({ teeTimeId, participantId })));
    }
  }
  done(trip.id);
}

export async function deleteTeeTime(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  const [event] = await db
    .select({ id: s.events.id })
    .from(s.events)
    .where(and(eq(s.events.id, text(fd, "eventId")), eq(s.events.tripId, trip.id)));
  if (!event) return;
  await db
    .delete(s.teeTimes)
    .where(and(eq(s.teeTimes.id, text(fd, "teeTimeId")), eq(s.teeTimes.eventId, event.id)));
  done(trip.id);
}

// ---------- Crew ----------

export async function saveParticipant(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const name = text(fd, "name");
  if (!name) return;
  const db = await getDb();
  const lodgingId = text(fd, "lodgingId");
  const [lodging] = isUuid(lodgingId)
    ? await db
        .select({ id: s.lodgings.id })
        .from(s.lodgings)
        .where(and(eq(s.lodgings.id, lodgingId), eq(s.lodgings.tripId, trip.id)))
    : [];
  const values = {
    name,
    hometown: text(fd, "hometown"),
    caddie: text(fd, "caddie"),
    lodgingId: lodging?.id ?? null,
    sortOrder: intOrNull(text(fd, "sortOrder")) ?? 0,
    privatePhone: text(fd, "privatePhone"),
    privateEmail: text(fd, "privateEmail"),
    privateNotes: text(fd, "privateNotes"),
  };
  const id = text(fd, "participantId");
  if (id) {
    await db
      .update(s.participants)
      .set(values)
      .where(and(eq(s.participants.id, id), eq(s.participants.tripId, trip.id)));
  } else {
    await db.insert(s.participants).values({ ...values, tripId: trip.id });
  }
  done(trip.id);
}

/** Paste a list of names, one per line, to add many golfers at once. */
export async function addParticipants(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const names = text(fd, "names")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (names.length === 0) return;
  const db = await getDb();
  await db.insert(s.participants).values(names.map((name) => ({ tripId: trip.id, name })));
  done(trip.id);
}

export async function deleteParticipant(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.participants)
    .where(and(eq(s.participants.id, text(fd, "participantId")), eq(s.participants.tripId, trip.id)));
  done(trip.id);
}

export async function saveLodging(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const name = text(fd, "name");
  if (!name) return;
  const values = { name, detail: text(fd, "detail") };
  const id = text(fd, "lodgingId");
  const db = await getDb();
  if (id) {
    await db
      .update(s.lodgings)
      .set(values)
      .where(and(eq(s.lodgings.id, id), eq(s.lodgings.tripId, trip.id)));
  } else {
    await db.insert(s.lodgings).values({ ...values, tripId: trip.id });
  }
  done(trip.id);
}

export async function deleteLodging(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.lodgings)
    .where(and(eq(s.lodgings.id, text(fd, "lodgingId")), eq(s.lodgings.tripId, trip.id)));
  done(trip.id);
}

export async function saveGroup(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const name = text(fd, "name");
  if (!name) return;
  const values = { name, description: text(fd, "description") };
  let id = text(fd, "groupId");
  const db = await getDb();
  if (id) {
    await db
      .update(s.groups)
      .set(values)
      .where(and(eq(s.groups.id, id), eq(s.groups.tripId, trip.id)));
  } else {
    const [created] = await db
      .insert(s.groups)
      .values({ ...values, tripId: trip.id })
      .returning();
    id = created.id;
  }
  const owned = await tripGroupId(trip.id, id);
  if (owned && fd.has("hasMembers")) {
    const ids = await tripPeopleIds(trip.id, fd.getAll("member").map(String));
    await db.delete(s.groupMembers).where(eq(s.groupMembers.groupId, owned));
    if (ids.length) {
      await db
        .insert(s.groupMembers)
        .values(ids.map((participantId) => ({ groupId: owned, participantId })));
    }
  }
  done(trip.id);
}

export async function deleteGroup(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.groups)
    .where(and(eq(s.groups.id, text(fd, "groupId")), eq(s.groups.tripId, trip.id)));
  done(trip.id);
}

// ---------- Scores ----------

export async function saveRound(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const courseName = text(fd, "courseName");
  const date = text(fd, "date");
  const par = intOrNull(text(fd, "par"));
  if (!courseName || !isDate(date) || par === null || par < 27 || par > 80) return;
  const values = { courseName, date, par, countsTowardTotal: fd.get("counts") === "on" };
  const id = text(fd, "roundId");
  const db = await getDb();
  if (id) {
    await db
      .update(s.rounds)
      .set(values)
      .where(and(eq(s.rounds.id, id), eq(s.rounds.tripId, trip.id)));
  } else {
    await db.insert(s.rounds).values({ ...values, tripId: trip.id });
  }
  done(trip.id);
}

export async function deleteRound(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  await db
    .delete(s.rounds)
    .where(and(eq(s.rounds.id, text(fd, "roundId")), eq(s.rounds.tripId, trip.id)));
  done(trip.id);
}

/** Saves the whole score grid. A blank cell removes that score. */
export async function saveScores(fd: FormData) {
  const { trip } = await requireTrip(text(fd, "tripId"));
  const db = await getDb();
  const [rounds, people] = await Promise.all([
    db.select({ id: s.rounds.id }).from(s.rounds).where(eq(s.rounds.tripId, trip.id)),
    db.select({ id: s.participants.id }).from(s.participants).where(eq(s.participants.tripId, trip.id)),
  ]);
  for (const round of rounds) {
    for (const person of people) {
      const key = `score:${round.id}:${person.id}`;
      if (!fd.has(key)) continue;
      const gross = intOrNull(text(fd, key));
      const where = and(eq(s.scores.roundId, round.id), eq(s.scores.participantId, person.id));
      if (gross === null) {
        await db.delete(s.scores).where(where);
      } else if (gross >= 18 && gross <= 250) {
        await db
          .insert(s.scores)
          .values({ roundId: round.id, participantId: person.id, gross })
          .onConflictDoUpdate({
            target: [s.scores.roundId, s.scores.participantId],
            set: { gross, updatedAt: new Date() },
          });
      }
    }
  }
  done(trip.id);
}
