import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/public/Countdown";
import { eventSummary } from "@/components/public/EventList";
import {
  Conditions,
  CourseCard,
  CourseFeature,
  EventRow,
  ForecastStrip,
  type RoundInfo,
} from "@/components/public/features";
import { Photo, PhotoCredit, type PhotoData } from "@/components/public/Photo";
import { courseFacts } from "@/lib/catalog";
import { HERO_SLOT, photoFor, photosForEvents, slotFor } from "@/lib/photos";
import {
  addDays,
  clockRange,
  dateRange,
  dayCount,
  daysBetween,
  eachDay,
  monthDay,
  weekday,
  zonedToUtc,
  type ZonedNow,
} from "@/lib/time";
import {
  directionsUrl,
  getTrip,
  getTripNow,
  roundNumbers,
  isPast,
  isUnderway,
  type PublicEvent,
  type PublicTrip,
} from "@/lib/trip";
import { getForecast, type DayWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

type Ctx = {
  data: PublicTrip;
  now: ZonedNow;
  hero: PhotoData;
  photos: Record<string, PhotoData>;
  weather: Record<string, DayWeather>;
  roundOf: (eventId: string) => RoundInfo | null;
};

export default async function TripHome({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip, events } = data;
  const [{ now, phase }, weather] = await Promise.all([getTripNow(trip), getForecast(trip)]);

  const rounds = roundNumbers(events);
  const ctx: Ctx = {
    data,
    now,
    weather,
    hero: photoFor(HERO_SLOT),
    photos: photosForEvents(events),
    roundOf: (eventId) => rounds[eventId] ?? null,
  };

  if (phase === "during") return <During {...ctx} />;
  if (phase === "after") return <After {...ctx} />;
  return <Before {...ctx} />;
}

const WIDE = "mx-auto w-full max-w-6xl px-5 md:px-10";
const SECTION = "pt-16 md:pt-24";
const scheduleHref = (slug: string, date?: string) =>
  `/t/${slug}/schedule${date ? `?day=${date}` : ""}`;

// ---------- Shared sections ----------

/**
 * The cover. On phones the photograph fills the top of the screen and the panel rides
 * up over its lower edge; on wide screens the photograph is the whole first screen, with
 * the title lower left and the panel lower right.
 */
function Cover({
  hero,
  tall,
  title,
  panel,
}: {
  hero: PhotoData;
  tall: boolean;
  title: React.ReactNode;
  panel?: React.ReactNode;
}) {
  const photoHeight = tall ? "h-[54svh] min-h-[360px]" : "h-[40svh] min-h-[300px]";
  return (
    <section
      className={`relative isolate ${
        tall ? "lg:h-[94svh] lg:max-h-[1000px] lg:min-h-[680px]" : "lg:h-[72svh] lg:min-h-[600px]"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 overflow-hidden bg-forest-deep ${photoHeight} lg:inset-0 lg:h-auto lg:min-h-0`}>
        <Photo photo={hero} slot={HERO_SLOT} priority sizes="100vw" />
        {/* Shade only behind the masthead and behind the title, lower left. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgb(13 33 27 / 0.6) 0%, rgb(13 33 27 / 0) 22%), radial-gradient(120% 85% at 0% 100%, rgb(13 33 27 / 0.92) 0%, rgb(13 33 27 / 0.55) 42%, rgb(13 33 27 / 0) 72%)",
          }}
        />
        <PhotoCredit photo={hero} className="absolute right-4 top-16 lg:top-20" />
      </div>
      <div
        className={`${WIDE} relative ${
          panel ? "lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end lg:gap-12 lg:pb-12" : "lg:flex lg:h-full lg:items-end lg:pb-12"
        }`}
      >
        <div className={`hero-copy flex flex-col justify-end pb-16 text-paper ${photoHeight} lg:h-auto lg:min-h-0 lg:pb-1`}>
          {title}
        </div>
        {panel && <div className="-mt-10 lg:mt-0">{panel}</div>}
      </div>
    </section>
  );
}

/** The one thing a golfer needs next, with its practical details spelled out. */
function NextPanel({
  label,
  event,
  slug,
  round,
  weather,
  photo,
}: {
  label: React.ReactNode;
  event: PublicEvent;
  slug: string;
  round: RoundInfo | null;
  weather?: DayWeather;
  photo: PhotoData;
}) {
  const golf = event.type === "golf";
  return (
    <div className="on-forest bg-forest text-limestone shadow-[0_24px_60px_-20px_rgb(13_33_27/0.7)] lg:bg-forest/92 lg:backdrop-blur-md">
      {photo && (
        <div className="relative hidden h-40 overflow-hidden lg:block">
          <Photo photo={photo} slot={slotFor(event)} sizes="400px" />
        </div>
      )}
      <div className="p-5 md:p-7">
        <p className="text-meta text-mist">{label}</p>
        <h2 className="display mt-2 text-[clamp(2.25rem,9vw,3rem)]">{event.title}</h2>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 border-t border-rule-light pt-4">
          <dt className="text-label self-baseline pt-0.5 text-mist">Day</dt>
          <dd className="figures text-ui font-semibold">
            {weekday(event.date)}, {monthDay(event.date)}
          </dd>
          {event.startTime && (
            <>
              <dt className="text-label self-baseline pt-0.5 text-mist">{golf ? "Tee times" : "Time"}</dt>
              <dd className="figures text-ui font-semibold">{clockRange(event.startTime, event.endTime)}</dd>
            </>
          )}
          {round ? (
            <>
              <dt className="text-label self-baseline pt-0.5 text-mist">Round</dt>
              <dd className="figures text-ui font-semibold">
                {round.number} of {round.total}, par {round.par}
              </dd>
            </>
          ) : (
            eventSummary(event) && (
              <>
                <dt className="text-label self-baseline pt-0.5 text-mist">Details</dt>
                <dd className="text-ui font-semibold">{eventSummary(event)}</dd>
              </>
            )
          )}
        </dl>
        {weather && <Conditions weather={weather} className="mt-4 border-t border-rule-light pt-4" />}
      </div>
      <div className="flex items-center gap-x-8 border-t border-rule-light px-5 md:px-7">
        <Link className="action" href={scheduleHref(slug, event.date)}>
          {weekday(event.date)}&rsquo;s schedule
        </Link>
        <a className="action" href={directionsUrl(event)} target="_blank" rel="noreferrer">
          Directions
        </a>
      </div>
    </div>
  );
}

function Forecast({
  data,
  weather,
  today,
}: {
  data: PublicTrip;
  weather: Ctx["weather"];
  today?: string;
}) {
  const days = eachDay(data.trip.startDate, data.trip.endDate);
  if (!days.some((d) => weather[d])) return null;
  const playing = Object.fromEntries(
    data.events.filter((e) => e.type === "golf").map((e) => [e.date, e.title]),
  );
  return (
    <section aria-labelledby="forecast" className="mt-16 md:mt-24 bg-forest-deep">
      <div className={`${WIDE} py-12 md:py-16`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="forecast" className="display text-[38px] text-limestone md:text-[52px]">
            The forecast
          </h2>
          <p className="text-meta text-mist">{data.trip.location}</p>
        </div>
        <div className="mt-7 md:mt-10">
          <ForecastStrip days={days} weather={weather} today={today} playing={playing} />
        </div>
        <div className="on-forest mt-4 text-limestone">
          <Link className="action" href={`/t/${data.trip.slug}/weather`}>
            Hour by hour on the live wind map
          </Link>
        </div>
        <p className="mt-2 text-fine text-mist">
          Forecast by{" "}
          <a
            className="underline underline-offset-2"
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo
          </a>
          , refreshed every half hour.
        </p>
      </div>
    </section>
  );
}

/**
 * The courses, laid out like a feature spread rather than a grid of equals: the first
 * gets a large photograph beside its details, the middle ones pair up at uneven widths,
 * and an odd one out runs the full width as a panorama. Phones swipe through all of them.
 */
function Courses({ data, photos, weather, roundOf, heading }: Ctx & { heading: string }) {
  const golf = data.events.filter((e) => e.type === "golf");
  if (golf.length === 0) return null;
  const [lead, ...rest] = golf;
  const props = (e: PublicEvent) => ({
    event: e,
    photo: photos[e.id],
    slot: slotFor(e),
    round: roundOf(e.id),
    facts: courseFacts(e.venue || e.title),
    weather: weather[e.date],
    href: scheduleHref(data.trip.slug, e.date),
  });
  const span = (i: number) => {
    if (rest.length % 2 === 1 && i === rest.length - 1) return "md:col-span-12 md:h-[380px]";
    const wideFirst = Math.floor(i / 2) % 2 === 0;
    return `md:h-[460px] ${(i % 2 === 0) === wideFirst ? "md:col-span-7" : "md:col-span-5"}`;
  };
  const phone = "aspect-[4/5] w-[84vw] shrink-0 snap-center md:aspect-auto md:w-auto";

  return (
    <section aria-labelledby="courses" className={SECTION}>
      <div className={`${WIDE} flex items-end justify-between gap-6`}>
        <h2 id="courses" className="display text-[44px] md:text-[72px]">
          {heading}
        </h2>
        <p className="hidden max-w-[17rem] pb-3 text-right text-meta text-moss md:block">
          Choose a course to see its day on the schedule.
        </p>
      </div>

      <div className={`${WIDE} mt-10 hidden lg:block`}>
        <CourseFeature {...props(lead)} sizes="(min-width: 1152px) 720px, 66vw" className="hidden lg:grid" />
      </div>

      <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 md:px-10 pb-2 [scrollbar-width:none] md:mx-auto md:mt-10 md:grid lg:mt-4 md:max-w-6xl md:grid-cols-12 md:gap-4 md:overflow-visible md:px-10 [&::-webkit-scrollbar]:hidden">
        <CourseCard {...props(lead)} sizes="(min-width: 768px) 100vw, 84vw" className={`${phone} md:col-span-12 md:h-[420px] lg:hidden`} />
        {rest.map((e, i) => (
          <CourseCard
            key={e.id}
            {...props(e)}
            sizes={`(min-width: 768px) ${span(i).includes("col-span-12") ? "100vw" : "58vw"}, 84vw`}
            className={`${phone} ${span(i)}`}
          />
        ))}
      </div>
    </section>
  );
}

/** Meals and everything else: compact rows, two short lists side by side on desktop. */
function OffCourse({ data, photos }: Ctx) {
  const { events, trip } = data;
  const tables = events.filter((e) => e.type === "dining");
  const others = events.filter((e) => e.type !== "golf" && e.type !== "dining");
  if (tables.length + others.length === 0) return null;
  const row = (e: PublicEvent) => (
    <EventRow
      key={e.id}
      event={e}
      photo={photos[e.id]}
      slot={slotFor(e)}
      showDay
      summary={
        e.type === "dining"
          ? [e.partySize && `Party of ${e.partySize}`, e.group]
              .filter(Boolean)
              .join(", ")
          : eventSummary(e)
      }
      note={e.reservationNote}
      href={scheduleHref(trip.slug, e.date)}
    />
  );
  return (
    <section
      aria-label="Off the course"
      className={`${WIDE} ${SECTION} grid gap-x-16 gap-y-12 ${
        tables.length && others.length ? "md:grid-cols-[1.5fr_1fr]" : ""
      }`}
    >
      {tables.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-[34px] md:text-[40px]">At the table</h2>
            <p className="text-meta text-moss">
              {tables.length} {tables.length === 1 ? "reservation" : "reservations"}
            </p>
          </div>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">{tables.map(row)}</ul>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h2 className="display text-[34px] md:text-[40px]">Between rounds</h2>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">{others.map(row)}</ul>
        </div>
      )}
    </section>
  );
}

/** Before the trip only: a pointer to the packing checklist, with its headline items. */
function PackingBand({ slug }: { slug: string }) {
  const headline = ["Two pairs of golf shoes", "Rain jacket and pants", "Layers", "Spare socks"];
  return (
    <section aria-labelledby="packing" className={`${WIDE} ${SECTION}`}>
      <Link
        href={`/t/${slug}/packing`}
        className="group grid gap-x-12 gap-y-5 border-y border-pine py-7 md:grid-cols-[auto_1fr_auto] md:items-center md:py-9"
      >
        <h2 id="packing" className="display text-[34px] md:text-[40px]">
          What to pack
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-ui font-medium">
          {headline.map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-copper" />
              {item}
            </li>
          ))}
        </ul>
        <span className="text-ui font-semibold underline decoration-copper decoration-1 underline-offset-[5px] group-hover:text-copper">
          Open the checklist
        </span>
      </Link>
    </section>
  );
}

function ScheduleBand({ slug }: { slug: string }) {
  return (
    <section className="on-forest mt-16 md:mt-24 bg-forest text-limestone">
      <div
        className={`${WIDE} flex flex-col gap-6 py-14 md:flex-row md:items-end md:justify-between md:py-20`}
      >
        <Link
          href={scheduleHref(slug)}
          className="display text-[clamp(2.75rem,12vw,6.5rem)] underline decoration-copper-light decoration-1 underline-offset-[0.14em] transition-colors hover:text-copper-light"
        >
          The full schedule
        </Link>
      </div>
    </section>
  );
}

// ---------- Before the trip ----------

function Before(ctx: Ctx) {
  const { data, now, hero, photos, weather, roundOf } = ctx;
  const { trip, events } = data;
  const golf = events.filter((e) => e.type === "golf");
  const tables = events.filter((e) => e.type === "dining");
  const first = events.find((e) => e.startTime) ?? events[0];
  const days = daysBetween(trip.startDate, trip.endDate) + 1;

  const metrics = [
    { value: days, label: days === 1 ? "day" : "days" },
    { value: golf.length, label: golf.length === 1 ? "round" : "rounds" },
    { value: tables.length, label: tables.length === 1 ? "table booked" : "tables booked" },
    { value: events.length, label: "events in all" },
  ].filter((m) => m.value > 0);

  return (
    <>
      <Cover
        hero={hero}
        tall
        title={
          <>
            <p className="text-ui font-semibold md:text-fact" style={{ "--i": 0 } as React.CSSProperties}>
              {dateRange(trip.startDate, trip.endDate)}
              {trip.location && <span className="ml-3 font-medium text-paper/85">{trip.location}</span>}
            </p>
            <h1
              className="display mt-2 text-[clamp(3.75rem,19vw,9rem)]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              {trip.title}
            </h1>
          </>
        }
        panel={
          first && (
            <NextPanel
              label={
                first.startTime ? (
                  <>
                    First {first.type === "golf" ? "tee time" : "event"} in{" "}
                    <Countdown
                      className="font-semibold lowercase text-limestone"
                      target={zonedToUtc(first.date, first.startTime, trip.timezone).toISOString()}
                      initialNow={now.instant.toISOString()}
                    />
                  </>
                ) : (
                  "First up"
                )
              }
              event={first}
              slug={trip.slug}
              round={roundOf(first.id)}
              weather={weather[first.date]}
              photo={photos[first.id]}
            />
          )
        }
      />

      <section aria-label="The trip in numbers" className={`${WIDE} pt-10 md:pt-16`}>
        <div className="grid gap-x-12 gap-y-6 md:grid-cols-[1fr_1.4fr] md:items-end">
          {trip.tagline && (
            <p className="serif text-[24px] italic leading-[1.3] md:text-[30px]">{trip.tagline}</p>
          )}
          <dl
            className="grid divide-x divide-rule border-y border-pine"
            style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
          >
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col-reverse px-3 py-4 first:pl-0 md:px-6 md:py-5">
                <dt className="mt-1 text-label leading-tight text-moss md:text-meta">{m.label}</dt>
                <dd className="display figures text-[44px] md:text-[64px]">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Courses {...ctx} heading={golf.length === 1 ? "The course" : "The courses"} />
      <Forecast data={data} weather={weather} />
      <OffCourse {...ctx} />
      <PackingBand slug={trip.slug} />
      <ScheduleBand slug={trip.slug} />
    </>
  );
}

// ---------- During the trip ----------

function During(ctx: Ctx) {
  const { data, now, hero, photos, weather, roundOf } = ctx;
  const { trip, events } = data;
  const today = events.filter((e) => e.date === now.date);
  const current = today.find((e) => isUnderway(e, now));
  const next = events.find((e) => !isPast(e, now) && !isUnderway(e, now));
  const featured = current ?? next;
  const restOfToday = today.filter((e) => e.id !== featured?.id && !isPast(e, now));
  const tomorrowDate = addDays(now.date, 1);
  const tomorrow = events.filter((e) => e.date === tomorrowDate);
  const tomorrowGolf = tomorrow.find((e) => e.type === "golf");
  const dayNumber = daysBetween(trip.startDate, now.date) + 1;
  const totalDays = daysBetween(trip.startDate, trip.endDate) + 1;

  let label = "Next";
  if (featured && current) label = "Happening now";
  else if (featured && featured.date === now.date) label = "Next today";
  else if (featured) label = `Next, ${weekday(featured.date)}`;

  const row = (e: PublicEvent) => (
    <EventRow key={e.id} event={e} photo={photos[e.id]} slot={slotFor(e)} summary={eventSummary(e)} />
  );

  return (
    <>
      <Cover
        hero={hero}
        tall={false}
        title={
          <>
            <p className="text-ui font-semibold md:text-fact" style={{ "--i": 0 } as React.CSSProperties}>
              {weekday(now.date)}, {monthDay(now.date)}
              <span className="ml-3 font-medium text-paper/85">
                Day {dayCount(dayNumber)} of {dayCount(totalDays)}
              </span>
            </p>
            <h1
              className="display mt-2 text-[clamp(3rem,14vw,7rem)]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              Today at Bandon
            </h1>
          </>
        }
        panel={
          featured ? (
            <NextPanel
              label={label}
              event={featured}
              slug={trip.slug}
              round={roundOf(featured.id)}
              weather={weather[featured.date]}
              photo={photos[featured.id]}
            />
          ) : (
            <p className="serif bg-forest p-6 text-[20px] italic text-limestone">
              Nothing left on the schedule. Safe travels home.
            </p>
          )
        }
      />

      <section aria-labelledby="later" className={`${WIDE} pt-12 md:pt-16`}>
        <div className="grid gap-x-12 md:grid-cols-[14rem_1fr]">
          <h2 id="later" className="display text-[34px] md:text-[40px]">
            {restOfToday.length > 0 ? "Later today" : "Today"}
          </h2>
          <div>
            {restOfToday.length > 0 ? (
              <ul className="mt-4 divide-y divide-rule border-y border-rule md:mt-0">{restOfToday.map(row)}</ul>
            ) : (
              <p className="serif mt-3 text-[18px] italic text-moss md:mt-2">
                Nothing else on the schedule today.
              </p>
            )}
            <Link className="action mt-2" href={scheduleHref(trip.slug, now.date)}>
              See today&rsquo;s schedule
            </Link>
          </div>
        </div>
      </section>

      <Forecast data={data} weather={weather} today={now.date} />

      {tomorrow.length > 0 && (
        <section aria-labelledby="tomorrow" className={`${WIDE} ${SECTION}`}>
          <h2 id="tomorrow" className="display text-[44px] md:text-[72px]">
            Tomorrow
          </h2>
          <div className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-[1.25fr_1fr] md:items-start">
            {tomorrowGolf && (
              <CourseCard
                event={tomorrowGolf}
                photo={photos[tomorrowGolf.id]}
                slot={slotFor(tomorrowGolf)}
                round={roundOf(tomorrowGolf.id)}
                facts={courseFacts(tomorrowGolf.venue || tomorrowGolf.title)}
                weather={weather[tomorrowGolf.date]}
                href={scheduleHref(trip.slug, tomorrowGolf.date)}
                sizes="(min-width: 768px) 55vw, 100vw"
                className="aspect-[4/3] md:aspect-auto md:h-[400px]"
              />
            )}
            <ul className="divide-y divide-rule border-y border-rule">
              {tomorrow.filter((e) => e.id !== tomorrowGolf?.id).map(row)}
            </ul>
          </div>
        </section>
      )}

      <ScheduleBand slug={trip.slug} />
    </>
  );
}

// ---------- After the trip ----------

function After(ctx: Ctx) {
  const { data, hero } = ctx;
  const { trip } = data;
  return (
    <>
      <Cover
        hero={hero}
        tall={false}
        title={
          <>
            <p className="text-ui font-semibold md:text-fact">{dateRange(trip.startDate, trip.endDate)}</p>
            <h1 className="display mt-2 text-[clamp(3rem,13vw,7rem)]">{trip.title}, in the books</h1>
          </>
        }
      />

      <Courses {...ctx} weather={{}} heading="Where we played" />
      <ScheduleBand slug={trip.slug} />
    </>
  );
}
