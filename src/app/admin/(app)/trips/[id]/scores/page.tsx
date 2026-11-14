import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { ConfirmButton, SubmitButton } from "@/components/admin/controls";
import { getDb, schema as s } from "@/db";
import { requireTrip } from "@/lib/auth";
import { monthDayShort } from "@/lib/time";
import { deleteRound, saveRound, saveScores } from "../../../../actions";

export const metadata: Metadata = { title: "Scores" };

export default async function ScoresAdmin({ params }: PageProps<"/admin/trips/[id]/scores">) {
  const { id } = await params;
  const { trip } = await requireTrip(id);
  const db = await getDb();
  const [rounds, people] = await Promise.all([
    db
      .select()
      .from(s.rounds)
      .where(eq(s.rounds.tripId, trip.id))
      .orderBy(asc(s.rounds.date), asc(s.rounds.courseName)),
    db
      .select({ id: s.participants.id, name: s.participants.name })
      .from(s.participants)
      .where(eq(s.participants.tripId, trip.id))
      .orderBy(asc(s.participants.sortOrder), asc(s.participants.name)),
  ]);
  const scores = rounds.length
    ? await db.select().from(s.scores).where(inArray(s.scores.roundId, rounds.map((r) => r.id)))
    : [];
  const grossOf = (roundId: string, participantId: string) =>
    scores.find((x) => x.roundId === roundId && x.participantId === participantId)?.gross ?? "";

  return (
    <>
      <section className="panel">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-[15px] font-semibold">Gross scores</h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Type each golfer&rsquo;s total for the round. Clear a box to remove a score. Saving
            publishes straight to the trip page.
          </p>
        </div>
        {people.length === 0 || rounds.length === 0 ? (
          <p className="px-4 py-6 text-zinc-500">
            {people.length === 0 ? (
              <>
                Add golfers on the{" "}
                <Link href={`/admin/trips/${trip.id}/crew`} className="underline">
                  Crew tab
                </Link>{" "}
                to start entering scores.
              </>
            ) : (
              "Add a round below to start entering scores."
            )}
          </p>
        ) : (
          <form action={saveScores}>
            <input type="hidden" name="tripId" value={trip.id} />
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Golfer</th>
                    {rounds.map((r) => (
                      <th key={r.id} className="!text-center">
                        {r.courseName}
                        <span className="block font-normal">
                          {monthDayShort(r.date)}, par {r.par}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="!border-b-zinc-100 !text-[14px] !text-zinc-900">
                        {p.name}
                      </th>
                      {rounds.map((r) => (
                        <td key={r.id} className="text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={18}
                            max={250}
                            name={`score:${r.id}:${p.id}`}
                            defaultValue={grossOf(r.id, p.id)}
                            aria-label={`${p.name}, ${r.courseName}`}
                            style={{ width: "4.5rem", textAlign: "center" }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-0 border-t border-zinc-200 bg-white p-3">
              <SubmitButton>Save scores</SubmitButton>
            </div>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-[15px] font-semibold">Rounds</h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Untick &ldquo;Counts&rdquo; for a fun round that shouldn&rsquo;t affect the overall board.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rounds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-end gap-2 px-4 py-3">
              <form
                action={saveRound}
                className="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr_5rem_auto_auto] sm:items-end"
              >
                <input type="hidden" name="tripId" value={trip.id} />
                <input type="hidden" name="roundId" value={r.id} />
                <div>
                  <label htmlFor={`course-${r.id}`}>Course</label>
                  <input id={`course-${r.id}`} name="courseName" type="text" defaultValue={r.courseName} required />
                </div>
                <div>
                  <label htmlFor={`date-${r.id}`}>Date</label>
                  <input id={`date-${r.id}`} name="date" type="date" defaultValue={r.date} required />
                </div>
                <div>
                  <label htmlFor={`par-${r.id}`}>Par</label>
                  <input id={`par-${r.id}`} name="par" type="number" min={27} max={80} defaultValue={r.par} required />
                </div>
                <label className="!mb-0 flex h-[34px] items-center gap-2 !text-[13px] !font-normal !text-zinc-800">
                  <input type="checkbox" name="counts" defaultChecked={r.countsTowardTotal} />
                  Counts
                </label>
                <SubmitButton className="btn">Save</SubmitButton>
              </form>
              <form action={deleteRound}>
                <input type="hidden" name="tripId" value={trip.id} />
                <input type="hidden" name="roundId" value={r.id} />
                <ConfirmButton message={`Delete the ${r.courseName} round and all its scores?`}>
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={saveRound}
          className="grid gap-2 border-t border-zinc-200 p-4 sm:grid-cols-[2fr_1fr_5rem_auto_auto] sm:items-end"
        >
          <input type="hidden" name="tripId" value={trip.id} />
          <div>
            <label htmlFor="new-course">New round: course</label>
            <input id="new-course" name="courseName" type="text" required />
          </div>
          <div>
            <label htmlFor="new-date">Date</label>
            <input id="new-date" name="date" type="date" defaultValue={trip.startDate} required />
          </div>
          <div>
            <label htmlFor="new-par">Par</label>
            <input id="new-par" name="par" type="number" min={27} max={80} defaultValue={72} required />
          </div>
          <label className="!mb-0 flex h-[34px] items-center gap-2 !text-[13px] !font-normal !text-zinc-800">
            <input type="checkbox" name="counts" defaultChecked />
            Counts
          </label>
          <SubmitButton>Add round</SubmitButton>
        </form>
      </section>
    </>
  );
}
