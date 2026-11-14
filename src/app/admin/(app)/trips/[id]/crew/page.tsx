import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { ConfirmButton, SubmitButton } from "@/components/admin/controls";
import { getDb, schema as s } from "@/db";
import { requireTrip } from "@/lib/auth";
import {
  addParticipants,
  deleteGroup,
  deleteLodging,
  deleteParticipant,
  saveGroup,
  saveLodging,
  saveParticipant,
} from "../../../../actions";

export const metadata: Metadata = { title: "Crew" };

export default async function CrewAdmin({ params }: PageProps<"/admin/trips/[id]/crew">) {
  const { id } = await params;
  const { trip } = await requireTrip(id);
  const db = await getDb();
  const [people, lodgings, groups] = await Promise.all([
    db
      .select()
      .from(s.participants)
      .where(eq(s.participants.tripId, trip.id))
      .orderBy(asc(s.participants.sortOrder), asc(s.participants.name)),
    db.select().from(s.lodgings).where(eq(s.lodgings.tripId, trip.id)).orderBy(asc(s.lodgings.name)),
    db.select().from(s.groups).where(eq(s.groups.tripId, trip.id)).orderBy(asc(s.groups.name)),
  ]);
  const members = groups.length
    ? await db
        .select()
        .from(s.groupMembers)
        .where(inArray(s.groupMembers.groupId, groups.map((g) => g.id)))
    : [];

  return (
    <>
      <section className="panel">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-[15px] font-semibold">
            Golfers <span className="font-normal text-zinc-500">{people.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Name, hometown, room and caddie are public. Phone, email and notes are only ever
            shown here.
          </p>
        </div>

        <ul className="divide-y divide-zinc-100">
          {people.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[13px] text-zinc-500">
                    {[lodgings.find((l) => l.id === p.lodgingId)?.name, p.caddie && `Caddie: ${p.caddie}`]
                      .filter(Boolean)
                      .join(" | ") || "Edit"}
                  </span>
                </summary>
                <form action={saveParticipant} className="mt-3 grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <div>
                    <label htmlFor={`name-${p.id}`}>Name</label>
                    <input id={`name-${p.id}`} name="name" type="text" defaultValue={p.name} required />
                  </div>
                  <div>
                    <label htmlFor={`home-${p.id}`}>Hometown</label>
                    <input id={`home-${p.id}`} name="hometown" type="text" defaultValue={p.hometown} />
                  </div>
                  <div>
                    <label htmlFor={`room-${p.id}`}>Room</label>
                    <select id={`room-${p.id}`} name="lodgingId" defaultValue={p.lodgingId ?? ""}>
                      <option value="">Not assigned</option>
                      {lodgings.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`caddie-${p.id}`}>Caddie</label>
                    <input id={`caddie-${p.id}`} name="caddie" type="text" defaultValue={p.caddie} />
                  </div>
                  <div>
                    <label htmlFor={`phone-${p.id}`}>Phone (private)</label>
                    <input id={`phone-${p.id}`} name="privatePhone" type="text" defaultValue={p.privatePhone} />
                  </div>
                  <div>
                    <label htmlFor={`email-${p.id}`}>Email (private)</label>
                    <input id={`email-${p.id}`} name="privateEmail" type="email" defaultValue={p.privateEmail} />
                  </div>
                  <div>
                    <label htmlFor={`notes-${p.id}`}>Notes (private)</label>
                    <input id={`notes-${p.id}`} name="privateNotes" type="text" defaultValue={p.privateNotes} />
                  </div>
                  <div>
                    <label htmlFor={`order-${p.id}`}>List order</label>
                    <input id={`order-${p.id}`} name="sortOrder" type="number" defaultValue={p.sortOrder} />
                  </div>
                  <div className="sm:col-span-4">
                    <SubmitButton>Save golfer</SubmitButton>
                  </div>
                </form>
                <form action={deleteParticipant} className="mt-2">
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <ConfirmButton message={`Remove ${p.name}? Their scores and assignments go too.`}>
                    Remove golfer
                  </ConfirmButton>
                </form>
              </details>
            </li>
          ))}
        </ul>

        <form action={addParticipants} className="border-t border-zinc-200 p-4">
          <input type="hidden" name="tripId" value={trip.id} />
          <label htmlFor="names">Add golfers, one name per line</label>
          <textarea id="names" name="names" rows={3} required />
          <div className="mt-2">
            <SubmitButton>Add golfers</SubmitButton>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-[15px] font-semibold">
          Rooms <span className="font-normal text-zinc-500">{lodgings.length}</span>
        </h2>
        <ul className="divide-y divide-zinc-100">
          {lodgings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-end gap-2 px-4 py-3">
              <form action={saveLodging} className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <input type="hidden" name="tripId" value={trip.id} />
                <input type="hidden" name="lodgingId" value={l.id} />
                <div>
                  <label htmlFor={`lname-${l.id}`}>Room</label>
                  <input id={`lname-${l.id}`} name="name" type="text" defaultValue={l.name} required />
                </div>
                <div>
                  <label htmlFor={`ldetail-${l.id}`}>Detail</label>
                  <input id={`ldetail-${l.id}`} name="detail" type="text" defaultValue={l.detail} />
                </div>
                <SubmitButton className="btn">Save</SubmitButton>
              </form>
              <form action={deleteLodging}>
                <input type="hidden" name="tripId" value={trip.id} />
                <input type="hidden" name="lodgingId" value={l.id} />
                <ConfirmButton message={`Delete ${l.name}? Golfers in it become unassigned.`}>
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={saveLodging}
          className="grid gap-2 border-t border-zinc-200 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        >
          <input type="hidden" name="tripId" value={trip.id} />
          <div>
            <label htmlFor="new-room">New room</label>
            <input id="new-room" name="name" type="text" required placeholder="Chrome Lake 3A" />
          </div>
          <div>
            <label htmlFor="new-room-detail">Detail</label>
            <input id="new-room-detail" name="detail" type="text" placeholder="Two queens" />
          </div>
          <SubmitButton>Add room</SubmitButton>
        </form>
      </section>

      <section className="panel">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-[15px] font-semibold">
            Groups <span className="font-normal text-zinc-500">{groups.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Use groups to aim events at part of the trip, like a dinner for five.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {groups.map((g) => {
            const selected = new Set(
              members.filter((m) => m.groupId === g.id).map((m) => m.participantId),
            );
            return (
              <li key={g.id} className="px-4 py-3">
                <form action={saveGroup} className="space-y-3">
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="groupId" value={g.id} />
                  <input type="hidden" name="hasMembers" value="1" />
                  <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                    <div>
                      <label htmlFor={`gname-${g.id}`}>Group</label>
                      <input id={`gname-${g.id}`} name="name" type="text" defaultValue={g.name} required />
                    </div>
                    <div>
                      <label htmlFor={`gdesc-${g.id}`}>Description</label>
                      <input id={`gdesc-${g.id}`} name="description" type="text" defaultValue={g.description} />
                    </div>
                    <SubmitButton className="btn">Save group</SubmitButton>
                  </div>
                  {people.length === 0 ? (
                    <p className="text-[13px] text-zinc-500">Add golfers above, then tick who&rsquo;s in.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      {people.map((p) => (
                        <label
                          key={p.id}
                          className="!mb-0 flex items-center gap-2 !text-[13px] !font-normal !text-zinc-800"
                        >
                          <input type="checkbox" name="member" value={p.id} defaultChecked={selected.has(p.id)} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  )}
                </form>
                <form action={deleteGroup} className="mt-2">
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="groupId" value={g.id} />
                  <ConfirmButton message={`Delete ${g.name}? Its events become open to everyone.`}>
                    Delete group
                  </ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
        <form
          action={saveGroup}
          className="grid gap-2 border-t border-zinc-200 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        >
          <input type="hidden" name="tripId" value={trip.id} />
          <div>
            <label htmlFor="new-group">New group</label>
            <input id="new-group" name="name" type="text" required />
          </div>
          <div>
            <label htmlFor="new-group-desc">Description</label>
            <input id="new-group-desc" name="description" type="text" />
          </div>
          <SubmitButton>Add group</SubmitButton>
        </form>
      </section>
    </>
  );
}
