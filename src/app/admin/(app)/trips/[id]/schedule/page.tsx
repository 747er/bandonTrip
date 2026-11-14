import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { SubmitButton } from "@/components/admin/controls";
import { EventFields } from "@/components/admin/EventFields";
import { getDb, schema as s } from "@/db";
import { requireTrip } from "@/lib/auth";
import { clockRange, monthDayShort, weekdayShort } from "@/lib/time";
import { saveEvent } from "../../../../actions";

export const metadata: Metadata = { title: "Schedule" };

export default async function ScheduleAdmin({ params }: PageProps<"/admin/trips/[id]/schedule">) {
  const { id } = await params;
  const { trip } = await requireTrip(id);
  const db = await getDb();
  const [events, groups] = await Promise.all([
    db
      .select()
      .from(s.events)
      .where(eq(s.events.tripId, trip.id))
      .orderBy(asc(s.events.date), asc(s.events.startTime), asc(s.events.title)),
    db.select().from(s.groups).where(eq(s.groups.tripId, trip.id)),
  ]);
  const groupName = (gid: string | null) => groups.find((g) => g.id === gid)?.name ?? "Everyone";

  return (
    <>
      <section className="panel overflow-x-auto">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-[15px] font-semibold">
          Events <span className="font-normal text-zinc-500">{events.length}</span>
        </h2>
        {events.length === 0 ? (
          <p className="px-4 py-6 text-zinc-500">Nothing scheduled. Add the first event below.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Event</th>
                <th>Type</th>
                <th>For</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-zinc-600">
                    {weekdayShort(e.date)} {monthDayShort(e.date)}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {e.startTime ? clockRange(e.startTime, e.endTime) : "All day"}
                  </td>
                  <td className="font-semibold">
                    <Link href={`/admin/trips/${trip.id}/schedule/${e.id}`} className="hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="capitalize text-zinc-600">{e.type}</td>
                  <td className="text-zinc-600">{groupName(e.groupId)}</td>
                  <td className="text-right">
                    <Link href={`/admin/trips/${trip.id}/schedule/${e.id}`} className="btn">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Add an event</h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Attendees and individual tee times are set on the next screen.
        </p>
        <form action={saveEvent} className="mt-4 space-y-4">
          <input type="hidden" name="tripId" value={trip.id} />
          <EventFields defaultDate={trip.startDate} showPar />
          <SubmitButton>Add event</SubmitButton>
        </form>
      </section>
    </>
  );
}
