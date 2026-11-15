import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseExplorer } from "@/components/public/CourseExplorer";
import { courseById } from "@/data/courses";
import { LODGING, STAY } from "@/data/trip";
import { contours } from "@/components/public/contours";
import { eventSummary } from "@/components/public/EventList";
import {
  CourseCard,
  EventRow,
  ForecastStrip,
  type RoundInfo,
} from "@/components/public/features";
import { WindGlyph } from "@/components/public/Glyphs";
import { MobileDay, type MobileStop } from "@/components/public/MobileDay";
import { CardDay, NextUp, StripMarker, type NextUpSlide } from "@/components/public/NextUp";
import { Photo, PhotoCredit, type PhotoData } from "@/components/public/Photo";
import { HERO_SLOT, photoFor, photosForEvents, slotFor, slotName } from "@/lib/photos";
import {
  addDays,
  clock,
  dateRange,
  eachDay,
  monthDay,
  weekday,
  weekdayShort,
  zonedToUtc,
  type ZonedNow,
} from "@/lib/time";
import { getTripNow, roundNumbers, isPast, isUnderway, type PublicEvent, type PublicTrip } from "@/lib/trip";
import { PLACES, RESORT_MAP } from "@/lib/resortMap";
import { getTrip } from "@/lib/viewer";
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

const HERO_TALL = "md:h-[78svh] md:min-h-[640px] lg:h-[90svh] lg:max-h-[960px] lg:min-h-[680px]";
const HERO_SHORT = "md:h-[64svh] md:min-h-[600px] lg:h-[70svh]";
/** The panel takes a third of the screen from tablet width up, and never less than it needs. */
const PANEL_W = "md:w-[max(34%,18.5rem)]";
const PANEL_GAP = "md:right-[max(34%,18.5rem)]";

const CONTOURS = [...contours(360, 70, 9, 34, 0.4), ...contours(40, 760, 7, 38, 2.1)];

/**
 * The cover. On phones: a compact photograph with the title, the four-day strip, then
 * the panel as a card. On wide screens the photograph is the whole first screen, the
 * title sits lower left, and the panel is a green field cut into the right of the
 * picture along a curve, with the strip running underneath.
 */
function Cover({
  hero,
  tall,
  title,
  panel,
  strip,
  phone,
}: {
  hero: PhotoData;
  tall: boolean;
  title: React.ReactNode;
  panel?: React.ReactNode;
  strip?: React.ReactNode;
  /** Phones get their own day tabs and summary in place of the strip and the panel */
  phone?: React.ReactNode;
}) {
  const photoHeight = tall ? "h-[48svh] min-h-[340px]" : "h-[42svh] min-h-[310px]";
  const heroHeight = tall ? HERO_TALL : HERO_SHORT;
  return (
    <section className="trip-arrival relative">
      <div className={`relative isolate overflow-hidden bg-forest-deep ${photoHeight} ${heroHeight}`}>
        {/* From tablet width up the photograph stops where the panel begins, so its
            subject is framed in the part you can see rather than hidden behind it. */}
        <div className={`arrival-photo absolute inset-0 ${panel ? PANEL_GAP : ""}`}>
          <Photo photo={hero} slot={HERO_SLOT} priority sizes="(min-width: 768px) 70vw, 100vw" />
        </div>
        {/* Shade only where type sits: behind the masthead, and from tablet width up
            behind the title, lower left. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgb(13 33 27 / 0.6) 0%, rgb(13 33 27 / 0) 22%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 85% at 0% 100%, rgb(13 33 27 / 0.9) 0%, rgb(13 33 27 / 0.5) 42%, rgb(13 33 27 / 0) 72%)",
          }}
        />
        <PhotoCredit photo={hero} className="absolute right-4 top-16 md:bottom-3 md:left-10 md:right-auto md:top-auto" />
        <div
          className={`hero-copy absolute inset-x-0 px-5 text-paper ${
            phone ? "bottom-0 pb-20 md:pt-0" : "bottom-0 pb-6"
          } md:px-10 md:pb-12 lg:pb-14 xl:pl-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))] ${
            panel ? "md:pr-[calc(max(34%,18.5rem)+6rem)] lg:pr-[calc(max(34%,18.5rem)+9rem)]" : ""
          }`}
        >
          {title}
        </div>
        {phone && <p className="absolute left-5 top-4 serif text-[17px] italic text-paper md:hidden">BandonTrip</p>}
      </div>

      {phone}
      <div className={phone ? "hidden md:block" : ""}>{strip}</div>

      {panel && (
        <div
          className={`${phone ? "hidden" : "mx-auto w-full max-w-6xl px-5 pt-5"} md:absolute md:right-0 md:top-0 md:mx-0 md:flex md:max-w-none md:items-center md:px-3 md:pb-6 md:pt-24 lg:px-6 xl:px-9 ${PANEL_W} ${heroHeight}`}
        >
          {/* The panel: a field of deep green cut into the photograph along a curve,
              drawn with contour lines and a fine copper line on its edge. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden overflow-hidden md:block"
            style={{ background: "linear-gradient(to bottom, #1d4033 0%, #17332b 45%, #10261f 100%)" }}
          >
            <svg className="h-full w-full" viewBox="0 0 400 820" preserveAspectRatio="xMaxYMid slice">
              <g fill="none" stroke="#e9e7e0" strokeWidth="1" opacity="0.1">
                {CONTOURS.map((points, n) => (
                  <polygon key={n} points={points} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            </svg>
          </div>
          <svg
            aria-hidden="true"
            className="absolute right-full top-0 hidden h-full w-20 md:block lg:w-36"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="panel-edge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1d4033" />
                <stop offset="0.45" stopColor="#17332b" />
                <stop offset="1" stopColor="#10261f" />
              </linearGradient>
            </defs>
            <path d="M101 0 C 52 24 88 64 0 100 L 101 100 Z" fill="url(#panel-edge)" />
            <path
              d="M101 0 C 52 24 88 64 0 100"
              fill="none"
              stroke="#d99a6c"
              strokeWidth="1.25"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="relative w-full">{panel}</div>
        </div>
      )}
    </section>
  );
}

/** Phones: the event panel. Opens on whatever is next; its arrows step through the rest. */
function phoneDays({ data, now, weather }: Ctx) {
  const { trip, events } = data;
  if (events.length === 0) return null;
  const upcoming = events.findIndex((e) => !isPast(e, now) && !isUnderway(e, now));
  const current = events.findIndex((e) => isUnderway(e, now));
  // After the last event has finished, rest on it.
  const initial = upcoming >= 0 ? upcoming : current >= 0 ? current : events.length - 1;
  const first = events[initial];
  return (
    <MobileDay
      key={data.viewer?.id ?? "nobody"}
      stops={events.map((e): MobileStop => ({ event: e, weather: weather[e.date] }))}
      initial={initial}
      live={upcoming >= 0 || current >= 0}
      underway={upcoming < 0 && current >= 0}
      start={first.startTime ? zonedToUtc(first.date, first.startTime, trip.timezone).toISOString() : null}
      slug={trip.slug}
      now={now.instant.toISOString()}
      timeZone={trip.timezone}
    />
  );
}

/** Screen pixels per map pixel in the small map beside the lodging. */
const NEAR = 0.85;

/** Where the viewer is staying: the place, who shares it, when to arrive, and where it is. */
function Stay({ data }: Ctx) {
  const { viewer, trip } = data;
  if (!viewer) return null;
  const mates = viewer.roommates;
  const place = PLACES[viewer.roomPlace];
  const lodging = LODGING[viewer.roomPlace];
  const slot = `lodging/${viewer.roomPlace}`;
  const photo = photoFor(slot);
  const inside = [`${slot}-living`, `${slot}-bedroom`].map((s) => [s, photoFor(s)] as const).filter(([, p]) => p);
  const mapHref = `${scheduleHref(trip.slug, trip.startDate)}#map`;

  const rows: { name: string; value: React.ReactNode }[] = [
    ...(mates.length > 0
      ? [{ name: "Staying with", value: <ul>{mates.map((name) => <li key={name}>{name}</li>)}</ul> }]
      : []),
    { name: "Check-in", value: <>{weekday(trip.startDate)}, {monthDay(trip.startDate)} <span className="block font-normal text-moss">from {clock(STAY.checkIn)}</span></> },
    { name: "Check-out", value: <>{weekday(trip.endDate)}, {monthDay(trip.endDate)} <span className="block font-normal text-moss">by {clock(STAY.checkOut)}</span></> },
    { name: "Shuttle", value: <a className="underline decoration-rule underline-offset-4 hover:decoration-copper" href={`tel:${STAY.shuttle.replace(/\D/g, "")}`}>{STAY.shuttle}</a> },
  ];

  return (
    <section id="stay" aria-labelledby="stay-heading" className={`${WIDE} scroll-mt-24 pt-10 md:pt-16`}>
      <div className="grid border-t border-copper bg-paper md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="flex flex-col gap-px">
          <div className="relative aspect-[16/10] flex-1 overflow-hidden bg-forest-deep md:aspect-auto md:min-h-[15rem]">
            <Photo photo={photo} slot={slot} alt={lodging?.name ?? viewer.room} sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
          {inside.length > 0 && (
            <div className="grid grid-cols-2 gap-px">
              {inside.map(([s, p]) => (
                <div key={s} className="relative aspect-[16/10] overflow-hidden bg-forest-deep">
                  <Photo photo={p} slot={s} sizes="(min-width: 768px) 20vw, 50vw" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 md:p-7">
          <p className="text-label font-semibold text-copper">Your stay</p>
          <h2 id="stay-heading" className="display mt-1.5 text-[34px] md:text-[40px]">{viewer.room}</h2>
          <dl className="figures mt-5 divide-y divide-rule border-y border-rule text-meta">
            {rows.map(({ name, value }) => (
              <div key={name} className="flex items-baseline gap-4 py-2.5">
                <dt className="w-[6.25rem] shrink-0 text-moss">{name}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {lodging?.about && <p className="mt-4 text-meta leading-relaxed text-moss">{lodging.about}</p>}
          {lodging && (
            <a className="action mt-2" href={lodging.url} target="_blank" rel="noreferrer">
              {lodging.name} at Bandon Dunes
            </a>
          )}
        </div>

        {place && (
          <Link
            href={mapHref}
            aria-label={`${lodging?.name ?? viewer.room} on the resort map`}
            className="group relative block min-h-[12rem] overflow-hidden border-t border-rule md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0"
          >
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={RESORT_MAP.src}
                alt=""
                className="absolute max-w-none"
                style={{
                  width: RESORT_MAP.width * NEAR,
                  left: `calc(50% - ${place.x * NEAR}px)`,
                  top: `calc(44% - ${place.y * NEAR}px)`,
                }}
              />
            </div>
            <div>
              <span
                aria-hidden="true"
                className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-paper bg-copper text-paper shadow-[0_2px_10px_rgb(13_33_27/0.45)]"
                style={{ left: "50%", top: "44%" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M2.5 7.5L8 3l5.5 4.5V13h-11z" />
                </svg>
              </span>
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-forest/92 px-4 py-2.5 text-label font-semibold text-limestone">
                {lodging?.name ?? viewer.room}
                <span className="flex items-center gap-2 text-copper-light">
                  Resort map
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" />
                  </svg>
                </span>
              </span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * The trip at a glance: each day and the course played on it. With the opening card
 * beside it, a day turns the card to that day; otherwise it opens the day's schedule.
 */
function Itinerary({ data, now, cardDate }: Ctx & { cardDate?: string }) {
  const { trip, events } = data;
  const days = eachDay(trip.startDate, trip.endDate);
  // With the card beside it, the day the card shows is marked, and the mark follows the
  // card. Without one, the next round still to be played marks its day.
  const nextRound = events.find((e) => e.type === "golf" && !isPast(e, now));
  return (
    <nav aria-label="The itinerary" className="bg-forest-deep text-limestone">
      <div className="relative mx-auto max-w-6xl px-2.5 md:px-4">
        {cardDate && (
          <div className="pointer-events-none absolute inset-y-0 left-2.5 right-2.5 z-10 md:left-4 md:right-4">
            <StripMarker days={days} shown={cardDate} />
          </div>
        )}
        <ol
          className="grid divide-x divide-rule-light"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((date) => {
            const main = events.find((e) => e.date === date && e.type === "golf") ?? events.find((e) => e.date === date);
            const card = cardDate !== undefined && main;
            const on = !cardDate && nextRound?.date === date;
            const href = scheduleHref(trip.slug, date);
            const className = `group flex h-full min-h-[4.5rem] flex-col justify-center border-t-2 px-2 py-3 transition-colors hover:bg-forest/70 md:px-6 md:py-5 ${
              on ? "border-copper-light" : "border-transparent"
            }`;
            const label = (
              <>
                <span
                  className={`figures text-label font-semibold transition-colors duration-500 group-aria-[current=true]:text-copper-light ${
                    on ? "text-copper-light" : "text-mist"
                  }`}
                >
                  {weekdayShort(date)} {Number(date.slice(8))}
                </span>
                <span className="serif mt-0.5 text-[14px] italic leading-tight md:text-[21px]">
                  {main ? main.title : "Open"}
                </span>
              </>
            );
            return (
              <li key={date}>
                {card ? (
                  <CardDay href={href} eventId={card.id} date={date} shown={cardDate} className={className}>
                    {label}
                  </CardDay>
                ) : (
                  <Link href={href} className={className}>
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** The opening card's slides: every event, and which one to open on. */
function cardDeck({ data, now, weather, roundOf }: Ctx) {
  const { trip, events } = data;
  const slides: NextUpSlide[] = events.map((e) => ({
    event: e,
    round: roundOf(e.id),
    weather: weather[e.date],
    start: e.startTime ? zonedToUtc(e.date, e.startTime, trip.timezone).toISOString() : null,
    state: isUnderway(e, now) ? "now" : isPast(e, now) ? "past" : "upcoming",
  }));
  // Open on what comes next, so mid-round the card already shows where dinner is. The
  // event under way is one step back. After the last start, stay on what is under way.
  const upcoming = slides.findIndex((x) => x.state === "upcoming");
  const initial = upcoming >= 0 ? upcoming : slides.findIndex((x) => x.state === "now");
  if (initial < 0) return null;
  return { slides, initial };
}

/** The opening card, and the day it opens on so the itinerary strip can mark it. */
function nextUp(ctx: Ctx) {
  const deck = cardDeck(ctx);
  if (!deck) return { card: null, cardDate: undefined };
  const { slides, initial } = deck;
  const { data, now } = ctx;
  const { trip } = data;
  const card = (
    <NextUp
      // Keyed by who is looking, so it reopens on that person's next event.
      key={data.viewer?.id ?? "nobody"}
      slides={slides}
      initial={initial}
      slug={trip.slug}
      now={now.instant.toISOString()}
      timeZone={trip.timezone}
    />
  );
  return { card, cardDate: slides[initial].event.date };
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
          <ForecastStrip days={days} weather={weather} today={today} playing={playing} slug={data.trip.slug} />
        </div>
        <Link
          href={`/t/${data.trip.slug}/weather`}
          className="mt-6 inline-flex min-h-11 items-center gap-2 bg-limestone px-4 text-meta font-semibold text-pine transition-colors hover:bg-paper"
        >
          <WindGlyph size={17} />
          Wind map
        </Link>
        <p className="mt-4 text-fine text-mist">
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

/** An interactive field guide, in the order this golfer plays. */
function Courses({ data, photos, weather, heading }: Ctx & { heading: string }) {
  const golf = data.events.filter((e) => e.type === "golf");
  if (!golf.length) return null;
  return <CourseExplorer heading={heading} courses={golf.map(e => ({
    id: e.id, title: e.title, date: e.date, time: e.startTime,
    photo: photos[e.id], slot: slotFor(e), weather: weather[e.date],
    course: courseById(slotName(e.title)), href: `/t/${data.trip.slug}/courses/${slotName(e.title)}`,
  }))} />;
}

/** The next few things on the schedule, in order and grouped by day, each leading to its day. */
function ComingUp({ data, photos, list, heading }: Ctx & { list: PublicEvent[]; heading: string }) {
  if (list.length === 0) return null;
  const { trip } = data;
  const dates = [...new Set(list.map((e) => e.date))];
  return (
    <section aria-labelledby="coming-up" className={`${WIDE} pt-12 md:pt-20`}>
      <div className="grid gap-x-12 md:grid-cols-[14rem_1fr]">
        <h2 id="coming-up" className="display text-[34px] md:text-[40px]">
          {heading}
        </h2>
        <div>
          {dates.map((date) => (
            <div key={date} className="mt-5 first:mt-4 md:first:mt-1">
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-copper">{weekday(date)}</h3>
              <ul className="mt-2.5 divide-y divide-rule border-y border-rule">
                {list
                  .filter((e) => e.date === date)
                  .map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      photo={photos[e.id]}
                      slot={slotFor(e)}
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
            </div>
          ))}
          <Link className="action mt-1" href={scheduleHref(trip.slug)}>
            The full schedule
          </Link>
        </div>
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
  const { card, cardDate } = nextUp(ctx);

  return (
    <>
      <Cover
        hero={hero}
        tall
        title={
          <>
            {/* The landscape leads; title and travel dates settle into its shaded foreground. */}

            <h1
              className="title text-[clamp(2.75rem,15vw,3.75rem)] md:mt-2 md:text-[clamp(4rem,9vw,8.5rem)]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              {trip.title}
            </h1>
            <p className="mt-4 text-[13px] font-medium md:mt-5 md:text-ui" style={{ "--i": 2 } as React.CSSProperties}>
              {dateRange(trip.startDate, trip.endDate)}
              {trip.location && <span className="ml-3 font-medium text-paper/85">{trip.location}</span>}
            </p>
          </>
        }
        panel={card}
        strip={<Itinerary {...ctx} cardDate={cardDate} />}
        phone={phoneDays(ctx)}
      />

      <Stay {...ctx} />
      <Courses {...ctx} heading={golf.length === 1 ? "The course" : "The courses"} />
      <Forecast data={data} weather={weather} />
      <ComingUp {...ctx} list={events.filter((e) => e.id !== first?.id).slice(0, 3)} heading="Coming up" />
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
  const { card, cardDate } = nextUp(ctx);

  const row = (e: PublicEvent) => (
    <EventRow key={e.id} event={e} photo={photos[e.id]} slot={slotFor(e)} summary={eventSummary(e)} />
  );

  return (
    <>
      <Cover
        hero={hero}
        tall={false}
        strip={<Itinerary {...ctx} cardDate={cardDate} />}
        phone={phoneDays(ctx)}
        title={
          <>
            <p className="text-meta font-semibold md:text-fact" style={{ "--i": 0 } as React.CSSProperties}>
              {weekday(now.date)}, {monthDay(now.date)}
            </p>
            <h1
              className="title mt-1 text-[clamp(2.5rem,12vw,3.5rem)] md:mt-2 md:text-[clamp(3.5rem,8vw,7rem)]"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              Today at Bandon
            </h1>
          </>
        }
        panel={
          card ?? (
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
                weather={weather[tomorrowGolf.date]}
                href={`/t/${trip.slug}/courses/${slotName(tomorrowGolf.title)}`}
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
        strip={<Itinerary {...ctx} />}
        phone={phoneDays(ctx)}
        title={
          <>
            <p className="text-ui font-semibold md:text-fact">{dateRange(trip.startDate, trip.endDate)}</p>
            <h1 className="title mt-2 text-[clamp(3rem,13vw,7rem)]">{trip.title}, in the books</h1>
          </>
        }
      />

      <Courses {...ctx} weather={{}} heading="Where we played" />
    </>
  );
}
