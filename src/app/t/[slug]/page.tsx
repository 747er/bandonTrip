import Link from "next/link";
import { notFound } from "next/navigation";
import { Carousel } from "@/components/public/Carousel";
import { eventSummary } from "@/components/public/EventList";
import {
  CourseCard,
  CourseFeature,
  EventRow,
  ForecastStrip,
  type RoundInfo,
} from "@/components/public/features";
import { NextUp, type NextUpSlide } from "@/components/public/NextUp";
import { Photo, PhotoCredit, type PhotoData } from "@/components/public/Photo";
import { courseFacts } from "@/lib/catalog";
import { HERO_SLOT, photoFor, photosForEvents, slotFor } from "@/lib/photos";
import {
  addDays,
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
 * The cover. On phones a compact photograph carries the title, and the panel sits clear
 * of it underneath: the picture sets the mood, the card does the work. On wide screens
 * the photograph is the whole first screen, title lower left and panel lower right.
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
  const photoHeight = tall ? "h-[40svh] min-h-[280px]" : "h-[32svh] min-h-[240px]";
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
        <div className={`hero-copy flex flex-col justify-end pb-6 text-paper ${photoHeight} lg:h-auto lg:min-h-0 lg:pb-1`}>
          {title}
        </div>
        {panel && <div className="pt-5 lg:pt-0">{panel}</div>}
      </div>
    </section>
  );
}

/** The opening card's slides: every event, and which one to open on. */
function nextUp({ data, now, photos, weather, roundOf }: Ctx) {
  const { trip, events } = data;
  const slides: NextUpSlide[] = events.map((e) => ({
    event: e,
    round: roundOf(e.id),
    weather: weather[e.date],
    photo: photos[e.id],
    slot: slotFor(e),
    start: e.startTime ? zonedToUtc(e.date, e.startTime, trip.timezone).toISOString() : null,
    state: isUnderway(e, now) ? "now" : isPast(e, now) ? "past" : "upcoming",
  }));
  // Open on what comes next, so mid-round the card already shows where dinner is. The
  // event under way is one step back. After the last start, stay on what is under way.
  const upcoming = slides.findIndex((x) => x.state === "upcoming");
  const initial = upcoming >= 0 ? upcoming : slides.findIndex((x) => x.state === "now");
  if (initial < 0) return null;
  return (
    <NextUp
      slides={slides}
      initial={initial}
      slug={trip.slug}
      now={now.instant.toISOString()}
      timeZone={trip.timezone}
    />
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
    <section aria-labelledby="forecast" className="mt-16 bg-forest-deep md:mt-24">
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
  const phone = "aspect-[4/5] w-[80vw] shrink-0 snap-start md:aspect-auto md:w-auto";

  return (
    <section aria-labelledby="courses" className="pt-12 md:pt-24">
      <div className={`${WIDE} flex items-end justify-between gap-6`}>
        <h2 id="courses" className="display text-[44px] md:text-[72px]">
          {heading}
        </h2>
      </div>

      <div className={`${WIDE} mt-10 hidden lg:block`}>
        <CourseFeature {...props(lead)} sizes="(min-width: 1152px) 720px, 66vw" className="hidden lg:grid" />
      </div>

      <Carousel
        label="The courses, in playing order"
        className="mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto scroll-smooth px-5 pb-1 [scrollbar-width:none] md:mx-auto md:mt-10 md:grid md:max-w-6xl md:grid-cols-12 md:gap-4 md:overflow-visible md:px-10 lg:mt-4 [&::-webkit-scrollbar]:hidden"
      >
        <CourseCard {...props(lead)} sizes="(min-width: 768px) 100vw, 84vw" className={`${phone} md:col-span-12 md:h-[420px] lg:hidden`} />
        {rest.map((e, i) => (
          <CourseCard
            key={e.id}
            {...props(e)}
            sizes={`(min-width: 768px) ${span(i).includes("col-span-12") ? "100vw" : "58vw"}, 84vw`}
            className={`${phone} ${span(i)}`}
          />
        ))}
      </Carousel>
    </section>
  );
}

/** The next few things on the schedule, in order, each leading to its day. */
function ComingUp({ data, photos, list, heading }: Ctx & { list: PublicEvent[]; heading: string }) {
  if (list.length === 0) return null;
  const { trip } = data;
  return (
    <section aria-labelledby="coming-up" className={`${WIDE} pt-12 md:pt-20`}>
      <div className="grid gap-x-12 md:grid-cols-[14rem_1fr]">
        <h2 id="coming-up" className="display text-[34px] md:text-[40px]">
          {heading}
        </h2>
        <div>
          <ul className="mt-3 divide-y divide-rule border-y border-rule md:mt-0">
            {list.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                photo={photos[e.id]}
                slot={slotFor(e)}
                showDay
                summary={
                  e.type === "dining"
                    ? [e.partySize && `Party of ${e.partySize}`, e.group].filter(Boolean).join(", ")
                    : eventSummary(e)
                }
                note={e.reservationNote}
                href={scheduleHref(trip.slug, e.date)}
              />
            ))}
          </ul>
          <Link className="action" href={scheduleHref(trip.slug)}>
            The full schedule
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The other pages, as plain rows: what each is for, and that it can be opened. */
function Essentials({ slug }: { slug: string }) {
  const links = [
    { href: scheduleHref(slug), name: "Schedule", detail: "Day by day, with the resort map" },
    { href: `/t/${slug}/weather`, name: "Wind map", detail: "Hour by hour, with daylight" },
    { href: `/t/${slug}/packing`, name: "Packing list", detail: "The resort's advice as a checklist" },
  ];
  return (
    <section aria-labelledby="essentials" className={`${WIDE} pb-14 pt-12 md:pb-20 md:pt-20`}>
      <div className="grid gap-x-12 md:grid-cols-[14rem_1fr]">
        <h2 id="essentials" className="display text-[34px] md:text-[40px]">
          Trip essentials
        </h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule md:mt-0">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="group flex min-h-[4.25rem] items-center gap-4 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="serif block text-[22px] leading-tight group-hover:text-forest">{link.name}</span>
                  <span className="mt-0.5 block text-meta text-moss">{link.detail}</span>
                </span>
                <svg width="9" height="16" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-copper" aria-hidden="true">
                  <path d="M1 1l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Before the trip ----------

function Before(ctx: Ctx) {
  const { data, hero, weather } = ctx;
  const { trip, events } = data;
  const golf = events.filter((e) => e.type === "golf");
  const first = events.find((e) => e.startTime) ?? events[0];

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
        panel={nextUp(ctx)}
      />

      <Courses {...ctx} heading={golf.length === 1 ? "The course" : "The courses"} />
      <Forecast data={data} weather={weather} />
      <ComingUp {...ctx} list={events.filter((e) => e.id !== first?.id).slice(0, 3)} heading="Coming up" />
      <Essentials slug={trip.slug} />
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
          nextUp(ctx) ?? (
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

      <Essentials slug={trip.slug} />
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
      <Essentials slug={trip.slug} />
    </>
  );
}
