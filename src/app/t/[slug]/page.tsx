import Link from "next/link";
import { notFound } from "next/navigation";
import { CoastScene } from "@/components/public/CoastScene";
import { Countdown } from "@/components/public/Countdown";
import { EventLines, eventSummary } from "@/components/public/EventList";
import { Leaderboard } from "@/components/public/Leaderboard";
import {
  addDays,
  clock,
  clockRange,
  dateRange,
  dayCount,
  daysBetween,
  monthDay,
  weekday,
  weekdayShort,
  zonedToUtc,
  type ZonedNow,
} from "@/lib/time";
import {
  directionsUrl,
  getTrip,
  getTripNow,
  isPast,
  isUnderway,
  type PublicEvent,
  type PublicTrip,
} from "@/lib/trip";

export const dynamic = "force-dynamic";

export default async function TripHome({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { now, phase } = await getTripNow(data.trip);

  if (phase === "during") return <During data={data} now={now} />;
  if (phase === "after") return <After data={data} />;
  return <Before data={data} now={now} />;
}

const shortDay = (date: string) => `${weekdayShort(date)} ${date.slice(8).replace(/^0/, "")}`;

function Updates({ updates, timezone }: Pick<PublicTrip, "updates"> & { timezone: string }) {
  if (updates.length === 0) return null;
  const when = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  return (
    <section aria-labelledby="updates" className="mx-auto max-w-2xl px-5 py-12 md:px-8">
      <h2 id="updates" className="display text-[34px]">
        From the organizer
      </h2>
      <ul className="mt-5 divide-y divide-rule border-y border-rule">
        {updates.slice(0, 4).map((u) => (
          <li key={u.id} className="py-4">
            <p className="serif whitespace-pre-line text-[17px] leading-relaxed">{u.body}</p>
            <p className="mt-1.5 text-[12.5px] text-moss">{when(u.createdAt)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The featured event on a forest field: what you need to know, at arm's length. */
function Feature({
  label,
  event,
  slug,
  children,
}: {
  label: string;
  event: PublicEvent;
  slug: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="on-forest bg-forest text-limestone">
      <div className="mx-auto max-w-2xl px-5 pb-12 pt-11 md:px-8 md:pb-16 md:pt-14">
        <p className="text-[14px] text-mist">{label}</p>
        <h2 className="display mt-3 text-[clamp(3rem,15vw,5.25rem)]">{event.title}</h2>
        <dl className="figures mt-7 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-rule-light pt-5 text-[15px]">
          <dt className="text-mist">When</dt>
          <dd>
            {weekday(event.date)}, {monthDay(event.date)}
          </dd>
          {event.startTime && (
            <>
              <dt className="text-mist">{event.type === "golf" ? "Tee times" : "Time"}</dt>
              <dd>{clockRange(event.startTime, event.endTime)}</dd>
            </>
          )}
          {event.venue && event.venue !== event.title && (
            <>
              <dt className="text-mist">Where</dt>
              <dd>{event.venue}</dd>
            </>
          )}
          {event.type !== "golf" && eventSummary(event) && (
            <>
              <dt className="text-mist">Who</dt>
              <dd>{eventSummary(event)}</dd>
            </>
          )}
          {children}
        </dl>
        <div className="mt-5 flex flex-wrap gap-x-7">
          <a className="action" href={directionsUrl(event)} target="_blank" rel="noreferrer">
            Get directions
          </a>
          <a className="action" href={`/t/${slug}/calendar.ics?event=${event.id}`}>
            Add to calendar
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------- Before the trip ----------

function Before({ data, now }: { data: PublicTrip; now: ZonedNow }) {
  const { trip, events, rounds, updates } = data;
  const golf = events.filter((e) => e.type === "golf");
  const firstRound = golf[0];
  const tables = events.filter((e) => e.type === "dining");
  const others = events.filter((e) => e.type !== "golf" && e.type !== "dining");
  const first = events.find((e) => e.startTime) ?? null;
  const parOf = (e: PublicEvent) => rounds.find((r) => r.eventId === e.id)?.par;

  return (
    <>
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-mist md:min-h-[760px] md:bg-limestone">
        {trip.heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.heroImageUrl}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover md:left-auto md:w-[46%]"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-limestone/85 via-limestone/10 to-forest-deep/80 md:hidden" />
          </>
        ) : (
          <>
            {/* Phones: the scene fills the cover. Wider screens: it becomes a plate beside the title. */}
            <CoastScene className="absolute inset-0 -z-10 h-full w-full md:left-auto md:w-[46%]" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-[34%] bg-gradient-to-t from-forest-deep/85 via-forest-deep/35 to-transparent md:hidden" />
          </>
        )}

        <div className="hero-copy w-full px-5 pt-[18svh] text-forest-deep md:w-[54%] md:px-10 md:pt-44 lg:px-16">
          <p className="text-[15px] font-medium" style={{ "--i": 0 } as React.CSSProperties}>
            {dateRange(trip.startDate, trip.endDate)}
          </p>
          <h1
            className="display mt-3 text-[clamp(4.5rem,23vw,11rem)] md:text-[clamp(6rem,11.5vw,11rem)]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            {trip.title}
          </h1>
          {trip.tagline && (
            <p
              className="serif mt-5 max-w-[22rem] text-[17px] italic leading-snug md:max-w-md md:text-[20px]"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              {trip.tagline}
            </p>
          )}
        </div>

        <div className="hero-copy mt-auto w-full px-5 pb-24 text-limestone md:w-[54%] md:px-10 md:pb-14 md:text-forest-deep lg:px-16">
          <div style={{ "--i": 4 } as React.CSSProperties}>
            {first?.startTime && (
              <Countdown
                target={zonedToUtc(first.date, first.startTime, trip.timezone).toISOString()}
                initialNow={now.instant.toISOString()}
                suffix={
                  first.type === "golf"
                    ? `until the first tee time at ${first.title}.`
                    : `until ${first.title}.`
                }
              />
            )}
          </div>
        </div>
        {trip.heroImageCredit && (
          <p className="absolute bottom-20 right-4 text-[11px] text-limestone/70 md:bottom-3">
            Photo: {trip.heroImageCredit}
          </p>
        )}
      </section>

      {firstRound && (
        <Feature label="The opening round" event={firstRound} slug={trip.slug}>
          {parOf(firstRound) && (
            <>
              <dt className="text-mist">Par</dt>
              <dd>{parOf(firstRound)}</dd>
            </>
          )}
        </Feature>
      )}

      {golf.length > 0 && (
        <section aria-labelledby="rounds" className="mx-auto max-w-2xl px-5 pt-14 md:px-8 md:pt-20">
          <h2 id="rounds" className="display text-[40px] md:text-[52px]">
            {golf.length === 1 ? "The round" : `${numberTitle(golf.length)} rounds`}
          </h2>
          <ol className="mt-6 border-t border-rule">
            {golf.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[3.25rem_1fr] items-baseline gap-x-4 border-b border-rule py-5"
              >
                <div className="leading-none">
                  <div className="text-[12.5px] text-moss">{weekdayShort(e.date)}</div>
                  <div className="display mt-1 text-[30px]">{e.date.slice(8).replace(/^0/, "")}</div>
                </div>
                <div className="min-w-0">
                  <div className="serif text-[23px] leading-tight md:text-[26px]">{e.title}</div>
                  <div className="figures mt-1.5 text-[13.5px] text-moss">
                    {[e.startTime && clockRange(e.startTime, e.endTime), parOf(e) && `par ${parOf(e)}`]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {tables.length > 0 && (
        <section aria-labelledby="tables" className="mx-auto max-w-2xl px-5 pt-14 md:px-8 md:pt-20">
          <h2 id="tables" className="display text-[40px] md:text-[52px]">
            Tables booked
          </h2>
          <div className="mt-6">
            <EventLines events={tables} showDay={shortDay} />
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="also" className="mx-auto max-w-2xl px-5 pt-14 md:px-8 md:pt-20">
          <h2 id="also" className="display text-[40px] md:text-[52px]">
            Also on the card
          </h2>
          <div className="mt-6">
            <EventLines events={others} showDay={shortDay} />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-2xl px-5 pb-4 pt-8 md:px-8">
        <Link className="action" href={`/t/${trip.slug}/schedule`}>
          See the full schedule
        </Link>
      </div>

      <Updates updates={updates} timezone={trip.timezone} />
      <div className="h-10" />
    </>
  );
}

const numberTitle = (n: number) =>
  ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][n] ?? String(n);

// ---------- During the trip ----------

function During({ data, now }: { data: PublicTrip; now: ZonedNow }) {
  const { trip, events, rounds, scores, people, updates } = data;
  const today = events.filter((e) => e.date === now.date);
  const current = today.find((e) => isUnderway(e, now));
  const next = events.find((e) => !isPast(e, now) && !isUnderway(e, now));
  const featured = current ?? next;
  const restOfToday = today.filter((e) => e.id !== featured?.id && !isPast(e, now));
  const earlier = today.filter((e) => e.id !== featured?.id && isPast(e, now));
  const tomorrowDate = addDays(now.date, 1);
  const tomorrow = events.filter((e) => e.date === tomorrowDate);
  const dayNumber = daysBetween(trip.startDate, now.date) + 1;
  const totalDays = daysBetween(trip.startDate, trip.endDate) + 1;
  const hasScores = scores.length > 0;

  let label = "Next";
  if (featured && current) label = "Happening now";
  else if (featured && featured.date === now.date) label = `Next, at ${clock(featured.startTime ?? "00:00")}`;
  else if (featured) label = `Next, ${weekday(featured.date)}`;

  return (
    <>
      <section className="mx-auto max-w-2xl px-5 pb-10 pt-24 md:px-8 md:pt-36">
        <p className="text-[14px] text-moss">
          {weekday(now.date)}, {monthDay(now.date)}. Day {dayCount(dayNumber)} of {dayCount(totalDays)}.
        </p>
        <h1 className="display mt-3 text-[clamp(3.25rem,16vw,6rem)]">Today at Bandon</h1>
      </section>

      {featured ? (
        <Feature label={label} event={featured} slug={trip.slug} />
      ) : (
        <section className="on-forest bg-forest text-limestone">
          <p className="serif mx-auto max-w-2xl px-5 py-12 text-[20px] italic md:px-8">
            Nothing left on the schedule. Safe travels home.
          </p>
        </section>
      )}

      {restOfToday.length > 0 && (
        <section aria-labelledby="later" className="mx-auto max-w-2xl px-5 pt-12 md:px-8">
          <h2 id="later" className="display text-[34px]">
            Later today
          </h2>
          <div className="mt-5">
            <EventLines events={restOfToday} />
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section aria-labelledby="earlier" className="mx-auto max-w-2xl px-5 pt-12 opacity-60 md:px-8">
          <h2 id="earlier" className="display text-[34px]">
            Earlier
          </h2>
          <div className="mt-5">
            <EventLines events={earlier} />
          </div>
        </section>
      )}

      <section aria-labelledby="board" className="mt-14 bg-forest-deep">
        <div className="mx-auto max-w-2xl px-5 py-11 md:px-8">
          <h2 id="board" className="display text-[34px] text-limestone">
            The board
          </h2>
          {hasScores ? (
            <div className="mt-3">
              <Leaderboard rounds={rounds} scores={scores} people={people} limit={5} />
            </div>
          ) : (
            <p className="serif mt-3 text-[17px] italic text-mist">
              No scores posted yet. They go up after the first round.
            </p>
          )}
          <div className="on-forest mt-3 text-limestone">
            <Link className="action" href={`/t/${trip.slug}/scores`}>
              See all scores
            </Link>
          </div>
        </div>
      </section>

      {tomorrow.length > 0 && (
        <section aria-labelledby="tomorrow" className="mx-auto max-w-2xl px-5 pt-12 md:px-8">
          <h2 id="tomorrow" className="display text-[34px]">
            Tomorrow
          </h2>
          <div className="mt-5">
            <EventLines events={tomorrow} />
          </div>
        </section>
      )}

      <Updates updates={updates} timezone={trip.timezone} />
      <div className="h-10" />
    </>
  );
}

// ---------- After the trip ----------

function After({ data }: { data: PublicTrip }) {
  const { trip, events, rounds, scores, people } = data;
  return (
    <>
      <section className="mx-auto max-w-2xl px-5 pb-10 pt-24 md:px-8 md:pt-36">
        <p className="text-[14px] text-moss">{dateRange(trip.startDate, trip.endDate)}</p>
        <h1 className="display mt-3 text-[clamp(3.25rem,16vw,6rem)]">{trip.title}, in the books</h1>
      </section>

      <section aria-labelledby="final" className="bg-forest-deep">
        <div className="mx-auto max-w-2xl px-5 py-11 md:px-8">
          <h2 id="final" className="display text-[34px] text-limestone">
            Final standings
          </h2>
          {scores.length > 0 ? (
            <div className="mt-3">
              <Leaderboard rounds={rounds} scores={scores} people={people} />
            </div>
          ) : (
            <p className="serif mt-3 text-[17px] italic text-mist">No scores were posted for this trip.</p>
          )}
          <div className="on-forest mt-3 text-limestone">
            <Link className="action" href={`/t/${trip.slug}/scores`}>
              Round by round
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="played" className="mx-auto max-w-2xl px-5 py-14 md:px-8">
        <h2 id="played" className="display text-[40px]">
          How it went
        </h2>
        <div className="mt-6">
          <EventLines events={events} showDay={shortDay} />
        </div>
      </section>
    </>
  );
}
