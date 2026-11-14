import { desc, eq } from "drizzle-orm";
import { ConfirmButton, SubmitButton } from "@/components/admin/controls";
import { getDb, schema as s } from "@/db";
import { getPreviewAt, requireTrip } from "@/lib/auth";
import {
  deleteUpdate,
  newShareLink,
  postUpdate,
  setPreview,
  updateTrip,
} from "../../../actions";

export default async function TripDetails({ params }: PageProps<"/admin/trips/[id]">) {
  const { id } = await params;
  const { trip } = await requireTrip(id);
  const db = await getDb();
  const updates = await db
    .select()
    .from(s.updates)
    .where(eq(s.updates.tripId, trip.id))
    .orderBy(desc(s.updates.createdAt));
  const previewAt = await getPreviewAt();

  return (
    <>
      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Trip details</h2>
        <form action={updateTrip} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tripId" value={trip.id} />
          <div>
            <label htmlFor="title">Name</label>
            <input id="title" name="title" type="text" defaultValue={trip.title} required />
          </div>
          <div>
            <label htmlFor="location">Location</label>
            <input id="location" name="location" type="text" defaultValue={trip.location} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="tagline">Line under the title</label>
            <input id="tagline" name="tagline" type="text" defaultValue={trip.tagline} />
          </div>
          <div>
            <label htmlFor="startDate">First day</label>
            <input id="startDate" name="startDate" type="date" defaultValue={trip.startDate} required />
          </div>
          <div>
            <label htmlFor="endDate">Last day</label>
            <input id="endDate" name="endDate" type="date" defaultValue={trip.endDate} required />
          </div>
          <div>
            <label htmlFor="timezone">Time zone</label>
            <select id="timezone" name="timezone" defaultValue={trip.timezone}>
              <option value="America/Los_Angeles">Pacific</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Phoenix">Arizona</option>
              <option value="America/Chicago">Central</option>
              <option value="America/New_York">Eastern</option>
              <option value="Europe/London">UK and Ireland</option>
            </select>
          </div>
          <div>
            <label htmlFor="visibility">Who can find it</label>
            <select id="visibility" name="visibility" defaultValue={trip.visibility}>
              <option value="unlisted">Unlisted: only people with the link</option>
              <option value="public">Public: shown at bandontrip.com, searchable</option>
            </select>
          </div>
          <div>
            <label htmlFor="latitude">Latitude (for the forecast)</label>
            <input id="latitude" name="latitude" type="text" inputMode="decimal" defaultValue={trip.latitude ?? ""} placeholder="43.188" />
          </div>
          <div>
            <label htmlFor="longitude">Longitude</label>
            <input id="longitude" name="longitude" type="text" inputMode="decimal" defaultValue={trip.longitude ?? ""} placeholder="-124.39" />
          </div>
          <div>
            <label htmlFor="heroImageUrl">Cover photo URL (optional)</label>
            <input
              id="heroImageUrl"
              name="heroImageUrl"
              type="url"
              defaultValue={trip.heroImageUrl ?? ""}
              placeholder="https://…"
            />
            <p className="mt-1 text-[12px] text-zinc-500">
              Overrides public/images/hero/bandon-coast.jpg. Only use photos you have the rights to.
            </p>
          </div>
          <div>
            <label htmlFor="heroImageCredit">Photo credit</label>
            <input
              id="heroImageCredit"
              name="heroImageCredit"
              type="text"
              defaultValue={trip.heroImageCredit ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Save details</SubmitButton>
          </div>
        </form>
      </section>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Share link</h2>
        <p className="mt-1 break-all font-mono text-[13px] text-zinc-700">/t/{trip.slug}</p>
        <form action={newShareLink} className="mt-3">
          <input type="hidden" name="tripId" value={trip.id} />
          <ConfirmButton
            className="btn"
            message="Create a new link? The current link will stop working for everyone who has it."
          >
            Replace with a new hard-to-guess link
          </ConfirmButton>
        </form>
      </section>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Updates</h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Short notes shown on the trip&rsquo;s home page, newest first.
        </p>
        <form action={postUpdate} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <input type="hidden" name="tripId" value={trip.id} />
          <label htmlFor="body" className="sr-only">
            New update
          </label>
          <textarea
            id="body"
            name="body"
            rows={2}
            required
            placeholder="Shuttle leaves the lodge at 7:40 tomorrow."
          />
          <SubmitButton>Post update</SubmitButton>
        </form>
        {updates.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {updates.map((u) => (
              <li key={u.id} className="flex items-start justify-between gap-4 py-3">
                <p className="whitespace-pre-line">{u.body}</p>
                <form action={deleteUpdate}>
                  <input type="hidden" name="tripId" value={trip.id} />
                  <input type="hidden" name="id" value={u.id} />
                  <ConfirmButton message="Delete this update?">Delete</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="text-[15px] font-semibold">Preview another moment</h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          The home page changes before, during and after the trip. See how it will look at a
          given time. Only you see the preview.
        </p>
        <form action={setPreview} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="tripId" value={trip.id} />
          <div>
            <label htmlFor="at">Date and time at the trip</label>
            <input
              id="at"
              name="at"
              type="datetime-local"
              defaultValue={previewAt ?? `${trip.startDate}T07:00`}
              required
              style={{ width: "auto" }}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5"
            />
          </div>
          <SubmitButton className="btn">Preview</SubmitButton>
        </form>
        {previewAt && (
          <form action={setPreview} className="mt-2">
            <input type="hidden" name="tripId" value={trip.id} />
            <button type="submit" className="btn">
              Stop previewing
            </button>
          </form>
        )}
      </section>
    </>
  );
}
