import { clock } from "@/lib/time";
import { directionsUrl, type PublicEvent, type PublicPerson } from "@/lib/trip";

const TYPE_LABEL: Record<PublicEvent["type"], string> = {
  golf: "Golf",
  dining: "Dining",
  activity: "Activity",
  lodging: "Lodging",
  custom: "",
};

/** One plain line describing who and what: "Golf, tee times until 11:10 AM". */
export function eventSummary(e: PublicEvent): string {
  const bits: string[] = [];
  if (e.type === "golf") {
    bits.push(e.endTime && e.endTime !== e.startTime ? `Tee times until ${clock(e.endTime)}` : "Golf");
  } else if (TYPE_LABEL[e.type]) {
    bits.push(TYPE_LABEL[e.type]);
  }
  if (e.partySize) bits.push(`party of ${e.partySize}`);
  if (e.audience.kind === "group") bits.push(e.audience.name);
  if (e.audience.kind === "people") {
    bits.push(`${e.audience.ids.length} ${e.audience.ids.length === 1 ? "golfer" : "golfers"}`);
  }
  const line = bits.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function TimeCell({ time, className = "" }: { time: string | null; className?: string }) {
  if (!time) return <span className={`text-[13px] text-moss ${className}`}>All day</span>;
  const [value, meridiem] = clock(time).split(" ");
  return (
    <span className={`figures whitespace-nowrap ${className}`}>
      <span className="text-[17px] font-medium">{value}</span>
      <span className="ml-1 text-[11px] font-medium text-moss">{meridiem}</span>
    </span>
  );
}

/** Compact, non-interactive rows for the home page. */
export function EventLines({
  events,
  showDay,
}: {
  events: PublicEvent[];
  showDay?: (date: string) => string;
}) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[5.25rem_1fr] items-baseline gap-x-4 py-4">
          <div>
            {showDay && <div className="text-[12.5px] text-moss">{showDay(e.date)}</div>}
            <TimeCell time={e.startTime} />
          </div>
          <div className="min-w-0">
            <div className="serif text-[21px] leading-tight">{e.title}</div>
            <div className="mt-1 text-[13.5px] text-moss">{eventSummary(e)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Full rows for the schedule: tap to open details, directions and calendar. */
export function EventDetails({
  event: e,
  people,
  slug,
  state,
}: {
  event: PublicEvent;
  people: PublicPerson[];
  slug: string;
  state?: "past" | "now" | null;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "";
  const attendees = e.audience.kind === "everyone" ? [] : e.audience.ids.map(nameOf).filter(Boolean);
  const assigned = e.teeTimes.filter((t) => t.playerIds.length > 0 || t.note);

  return (
    <details className={`event group ${state === "past" ? "opacity-55" : ""}`}>
      <summary className="grid grid-cols-[5.25rem_1fr_auto] items-baseline gap-x-4 py-5">
        <TimeCell time={e.startTime} />
        <div className="min-w-0">
          <div className="serif text-[23px] leading-[1.15] md:text-[26px]">{e.title}</div>
          <div className="mt-1.5 text-[13.5px] text-moss">
            {state === "now" && <span className="mr-2 font-semibold text-copper">Now</span>}
            {eventSummary(e)}
          </div>
        </div>
        <svg
          className="toggle mt-1 self-start text-moss"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 3v12M3 9h12" />
        </svg>
      </summary>

      <div className="event-body grid grid-cols-[5.25rem_1fr] gap-x-4 pb-6">
        <div className="col-start-2 space-y-4 text-[15px] leading-relaxed">
          {e.description && <p className="serif max-w-prose whitespace-pre-line">{e.description}</p>}

          <dl className="space-y-1.5 text-[14px]">
            {e.venue && e.venue !== e.title && (
              <div className="flex gap-3">
                <dt className="w-[5.5rem] shrink-0 text-moss">Where</dt>
                <dd>{e.venue}</dd>
              </div>
            )}
            {e.reservationNote && (
              <div className="flex gap-3">
                <dt className="w-[5.5rem] shrink-0 text-moss">Reservation</dt>
                <dd>{e.reservationNote}</dd>
              </div>
            )}
            {attendees.length > 0 && (
              <div className="flex gap-3">
                <dt className="w-[5.5rem] shrink-0 text-moss">Who</dt>
                <dd>{attendees.join(", ")}</dd>
              </div>
            )}
          </dl>

          {assigned.length > 0 && (
            <table className="w-full max-w-md text-[14px]">
              <caption className="pb-1 text-left text-moss">Tee times</caption>
              <tbody className="divide-y divide-rule border-y border-rule">
                {assigned.map((t) => (
                  <tr key={t.id}>
                    <th scope="row" className="figures w-20 py-2 text-left align-top font-medium">
                      {clock(t.time)}
                    </th>
                    <td className="py-2">
                      {t.playerIds.map(nameOf).filter(Boolean).join(", ")}
                      {t.note && <span className="block text-moss">{t.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex flex-wrap gap-x-7">
            {(e.venue || e.address) && (
              <a className="action" href={directionsUrl(e)} target="_blank" rel="noreferrer">
                Get directions
              </a>
            )}
            <a className="action" href={`/t/${slug}/calendar.ics?event=${e.id}`}>
              Add to calendar
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}
