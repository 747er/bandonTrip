import { EVENT_TYPES, type TripEvent } from "@/db/schema";

const TYPE_NAMES: Record<(typeof EVENT_TYPES)[number], string> = {
  golf: "Golf",
  dining: "Dining",
  activity: "Activity",
  lodging: "Lodging",
  custom: "Other",
};

/** The shared fields of the add-event and edit-event forms. */
export function EventFields({
  event,
  defaultDate,
  showPar,
}: {
  event?: TripEvent;
  defaultDate: string;
  showPar?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={event?.type ?? "golf"}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_NAMES[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-4">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" defaultValue={event?.title} required />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={event?.date ?? defaultDate} required />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="startTime">Starts (first tee time for golf)</label>
        <input id="startTime" name="startTime" type="time" defaultValue={event?.startTime ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="endTime">Ends (last tee time for golf)</label>
        <input id="endTime" name="endTime" type="time" defaultValue={event?.endTime ?? ""} />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor="venue">Venue</label>
        <input id="venue" name="venue" type="text" defaultValue={event?.venue} />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor="address">Address (for directions)</label>
        <input id="address" name="address" type="text" defaultValue={event?.address} />
      </div>
      {showPar && (
        <div className="sm:col-span-2">
          <label htmlFor="par">Par (golf only)</label>
          <input id="par" name="par" type="number" min={27} max={80} placeholder="72" />
        </div>
      )}
      <div className="sm:col-span-6">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} defaultValue={event?.description} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="partySize">Party size</label>
        <input
          id="partySize"
          name="partySize"
          type="number"
          min={1}
          defaultValue={event?.partySize ?? ""}
        />
      </div>
      <div className="sm:col-span-4">
        <label htmlFor="reservationNote">Reservation note (public)</label>
        <input
          id="reservationNote"
          name="reservationNote"
          type="text"
          defaultValue={event?.reservationNote}
          placeholder="Booked under the club's name"
        />
      </div>
      <div className="sm:col-span-6">
        <label htmlFor="privateNote">Private note (only you see this)</label>
        <input
          id="privateNote"
          name="privateNote"
          type="text"
          defaultValue={event?.privateNote}
          placeholder="Confirmation numbers, deposits"
        />
      </div>
    </div>
  );
}
