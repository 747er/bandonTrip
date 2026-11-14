import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SubmitButton } from "@/components/admin/controls";
import { getDb, schema as s } from "@/db";
import { requireOrganizer } from "@/lib/auth";
import { dateRange } from "@/lib/time";
import { createTrip } from "../actions";

export default async function AdminHome() {
  const organizer = await requireOrganizer();
  const db = await getDb();
  const trips = await db
    .select()
    .from(s.trips)
    .where(eq(s.trips.ownerId, organizer.id))
    .orderBy(desc(s.trips.startDate));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <section className="panel">
        <h1 className="border-b border-zinc-200 px-4 py-3 text-[15px] font-semibold">Your trips</h1>
        {trips.length === 0 ? (
          <p className="px-4 py-6 text-zinc-500">No trips yet. Create one below.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Trip</th>
                <th>Dates</th>
                <th>Link</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">
                    <Link href={`/admin/trips/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-zinc-600">{dateRange(t.startDate, t.endDate)}</td>
                  <td className="text-zinc-600">
                    {t.visibility === "public" ? "Public" : "Unlisted"}
                    <span className="ml-2 text-zinc-400">/t/{t.slug}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/admin/trips/${t.id}`} className="btn">
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
        <h2 className="text-[15px] font-semibold">New trip</h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Starts unlisted, with a link that&rsquo;s hard to guess.
        </p>
        <form action={createTrip} className="mt-4 grid gap-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="title">Name</label>
            <input id="title" name="title" type="text" required placeholder="Bandon 2027" />
          </div>
          <div>
            <label htmlFor="location">Location</label>
            <input id="location" name="location" type="text" placeholder="Bandon, Oregon" />
          </div>
          <div>
            <label htmlFor="startDate">First day</label>
            <input id="startDate" name="startDate" type="date" required />
          </div>
          <div>
            <label htmlFor="endDate">Last day</label>
            <input id="endDate" name="endDate" type="date" required />
          </div>
          <SubmitButton>Create trip</SubmitButton>
        </form>
      </section>
    </main>
  );
}
