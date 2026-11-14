import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ConfirmButton, SubmitButton } from "@/components/admin/controls";
import { EventFields } from "@/components/admin/EventFields";
import { PeoplePicker } from "@/components/admin/PeoplePicker";
import { getDb, schema as s } from "@/db";
import { requireTrip } from "@/lib/auth";
import { deleteEvent, deleteTeeTime, saveEvent, saveTeeTime } from "../../../../../actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EventAdmin({
  params,
}: PageProps<"/admin/trips/[id]/schedule/[eventId]">) {
  const { id, eventId } = await params;
  const { trip } = await requireTrip(id);
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) redirect(`/admin/trips/${trip.id}/schedule`);
  const [event] = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.id, eventId), eq(s.events.tripId, trip.id)));
  if (!event) redirect(`/admin/trips/${trip.id}/schedule`);

  const [people, groups, attendees, teeTimes] = await Promise.all([
    db
      .select({ id: s.participants.id, name: s.participants.name })
      .from(s.participants)
      .where(eq(s.participants.tripId, trip.id))
      .orderBy(asc(s.participants.sortOrder), asc(s.participants.name)),
    db.select().from(s.groups).where(eq(s.groups.tripId, trip.id)).orderBy(asc(s.groups.name)),
    db.select().from(s.eventAttendees).where(eq(s.eventAttendees.eventId, event.id)),
    db.select().from(s.teeTimes).where(eq(s.teeTimes.eventId, event.id)).orderBy(asc(s.teeTimes.time)),
  ]);
  const players = teeTimes.length
    ? await db
        .select()
        .from(s.teeTimePlayers)
        .where(inArray(s.teeTimePlayers.teeTimeId, teeTimes.map((t) => t.id)))
    : [];
  const attending = new Set(attendees.map((a) => a.participantId));
  const audience = attending.size > 0 ? "people" : (event.groupId ?? "everyone");

  return (
    <>
      <p>
        <Link href={`/admin/trips/${trip.id}/schedule`} className="text-[13px] text-zinc-600 hover:underline">
          ← All events
        </Link>
      </p>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">{event.title}</h2>
        <form action={saveEvent} className="mt-4 space-y-4">
          <input type="hidden" name="tripId" value={trip.id} />
          <input type="hidden" name="eventId" value={event.id} />
          <EventFields event={event} defaultDate={trip.startDate} />

          <fieldset className="border-t border-zinc-100 pt-4">
            <legend className="text-[12px] font-semibold text-zinc-600">Who it&rsquo;s for</legend>
            <div className="mt-2 max-w-sm">
              <label htmlFor="audience" className="sr-only">
                Audience
              </label>
              <select id="audience" name="audience" defaultValue={audience}>
                <option value="everyone">Everyone on the trip</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group: {g.name}
                  </option>
                ))}
                <option value="people">Only the golfers ticked below</option>
              </select>
            </div>
            <div className="mt-3">
              <PeoplePicker name="attendee" people={people} selected={attending} tripId={trip.id} />
            </div>
          </fieldset>

          <SubmitButton>Save event</SubmitButton>
        </form>
      </section>

      {event.type === "golf" && (
        <section className="panel p-4">
          <h2 className="text-[15px] font-semibold">Tee times</h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Optional. Assigned tee times appear on the schedule and as pairings on the Crew page.
          </p>
          <div className="mt-4 space-y-4">
            {teeTimes.map((t) => {
              const selected = new Set(
                players.filter((p) => p.teeTimeId === t.id).map((p) => p.participantId),
              );
              return (
                <div key={t.id} className="rounded-md border border-zinc-200 p-3">
                  <form action={saveTeeTime} className="space-y-3">
                    <input type="hidden" name="tripId" value={trip.id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="teeTimeId" value={t.id} />
                    <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
                      <div>
                        <label htmlFor={`time-${t.id}`}>Time</label>
                        <input id={`time-${t.id}`} name="time" type="time" defaultValue={t.time} required />
                      </div>
                      <div>
                        <label htmlFor={`note-${t.id}`}>Note</label>
                        <input id={`note-${t.id}`} name="note" type="text" defaultValue={t.note} />
                      </div>
                      <SubmitButton>Save tee time</SubmitButton>
                    </div>
                    <PeoplePicker name="player" people={people} selected={selected} tripId={trip.id} />
                  </form>
                  <form action={deleteTeeTime} className="mt-3">
                    <input type="hidden" name="tripId" value={trip.id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="teeTimeId" value={t.id} />
                    <ConfirmButton message={`Delete the ${t.time} tee time?`}>Delete tee time</ConfirmButton>
                  </form>
                </div>
              );
            })}
            <form action={saveTeeTime} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="eventId" value={event.id} />
              <div>
                <label htmlFor="new-time">New tee time</label>
                <input id="new-time" name="time" type="time" defaultValue={event.startTime ?? ""} required />
              </div>
              <div>
                <label htmlFor="new-note">Note</label>
                <input id="new-note" name="note" type="text" />
              </div>
              <SubmitButton className="btn">Add tee time</SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section className="panel flex items-center justify-between gap-4 p-4">
        <p className="text-[13px] text-zinc-600">
          Deleting an event removes its attendees and tee times. Scores stay with the round.
        </p>
        <form action={deleteEvent}>
          <input type="hidden" name="tripId" value={trip.id} />
          <input type="hidden" name="eventId" value={event.id} />
          <ConfirmButton message={`Delete "${event.title}"? This can't be undone.`}>
            Delete event
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
