"use client";

import Link from "next/link";
import { useState } from "react";
import { clock, monthDay, monthDayShort, weekday, weekdayShort } from "@/lib/time";
import type { PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { compass, degreesOf, type ForecastAt } from "@/lib/windMath";
import { Countdown } from "./Countdown";
import { DayMap, type MapStop } from "./DayMap";
import type { RoundInfo } from "./features";
import { WeatherGlyph } from "./Glyphs";
import { Photo, type PhotoData } from "./Photo";

export type ScheduleProps = {
  days: string[];
  events: PublicEvent[];
  photos: Record<string, PhotoData>;
  slots: Record<string, string>;
  weather: Record<string, DayWeather>;
  rounds: Record<string, RoundInfo>;
  /** "past" | "now" per event id, only set while the trip is under way */
  states: Record<string, "past" | "now">;
  /** Address of the course page for each round that has one */
  courses: Record<string, string>;
  /** "Par 71 · 6,944 yards", for each round with a course page */
  courseFacts: Record<string, string>;
  /** Forecast at each event's start */
  atStart: Record<string, ForecastAt>;
  /** A note for outdoor events that run past sunset */
  lateNote: Record<string, string>;
  /** Sunrise and sunset per date: formatted, and as 24-hour "HH:MM" */
  daylight: Record<string, { sunrise: string; sunset: string; rise: string; set: string }>;
  /** Resort-map place id per event id, for events the map can show */
  places: Record<string, string>;
  /** Place id of where the group is staying, if it is on the map */
  homePlace: string | null;
  /** The viewer's room, by name */
  homeLabel: string | null;
  /** Where each event is, in words: "Old Macdonald clubhouse" */
  where: Record<string, string>;
  /** Who else is at each meal or outing, by event id */
  party: Record<string, string[]>;
  /** The whole group's first tee time for each round, already formatted */
  firstTee: Record<string, string>;
  /** ISO instant of the viewer's tee time, for rounds today or tomorrow */
  teeStarts: Record<string, string>;
  /** ISO instant the server rendered at */
  now: string;
  timeZone: string;
  /** The resort shuttle's phone number */
  shuttle: string;
  /** The viewer's full name, to set them first in their own foursome */
  viewerName: string | null;
  initialDay: string;
  today: string | null;
};

const ArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
    <path d="M4 12h15m-6-6 6 6-6 6" />
  </svg>
);

/** A compass with the arrow pointing where the wind is going. */
const Compass = ({ from, size, label }: { from: number; size: number; label: string }) => (
  <svg width={size} height={size} viewBox="0 0 52 52" className="shrink-0" role="img" aria-label={label}>
    <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeOpacity=".28" />
    <path d="M26 3v3M49 26h-3M26 49v-3M3 26h3" stroke="currentColor" strokeOpacity=".5" />
    <text x="26" y="13.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="currentColor" fillOpacity=".75">N</text>
    <path d="M26 16L32 34L26 30L20 34Z" fill="var(--card-accent, var(--color-copper-light))" transform={`rotate(${from + 180} 26 26)`} />
  </svg>
);

/** A large figure with its unit: "14 mph". */
const Figure = ({ value, unit }: { value: React.ReactNode; unit?: string }) => (
  <dd className="mt-1.5 flex items-baseline gap-[5px] whitespace-nowrap">
    <span className="display text-[30px] leading-none">{value}</span>
    {unit && <span className="text-[13px] font-semibold">{unit}</span>}
  </dd>
);

/** "JD, Justin, Jason, Erich and Cam" */
const firstNames = (names: string[]) => {
  const first = names.map((n) => n.split(" ")[0]);
  return first.length > 1 ? `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}` : first[0];
};

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One day at a time, led by the viewer's own round: their tee time, foursome, the wind at
 * the first tee and the clubhouse with the way there from their room. The course itself
 * is one link; the rest of the day and its general forecast follow.
 */
export function ScheduleView(props: ScheduleProps) {
  const { days, events, weather, today } = props;
  const [day, setDay] = useState(props.initialDay);
  const dayEvents = events.filter((e) => e.date === day);
  const round = dayEvents.find((e) => e.type === "golf") ?? null;
  const rest = dayEvents.filter((e) => e !== round);
  // Every event keeps its place in the day: the same number on the map and the daylight bar.
  const order = (e: PublicEvent) => dayEvents.indexOf(e) + 1;
  const stops: MapStop[] = dayEvents
    .filter((e) => props.places[e.id])
    .map((e) => ({
      eventId: e.id,
      number: order(e),
      title: e.title,
      time: e.startTime ? clock(e.startTime) : "All day",
      type: e.type,
      placeId: props.places[e.id],
    }));
  const [activeStop, setActiveStop] = useState<string | null>(null);

  const choose = (date: string) => {
    setDay(date);
    setActiveStop(null);
    const url = new URL(window.location.href);
    url.searchParams.set("day", date);
    url.hash = "";
    window.history.replaceState(null, "", url);
  };

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? "instant" : "smooth", block: "start" });

  const round_ = round ? props.rounds[round.id] : undefined;
  const subtitle = round_ ? `${monthDayShort(day)} · Round ${round_.number} of ${round_.total}` : monthDay(day);

  return (
    <div className="schedule-page mx-auto max-w-6xl px-5 pb-16 pt-14 md:px-10 md:pt-24">
      <h1 className="sr-only">Schedule</h1>

      {/* Day picker: each day carries its tee time, and stays in reach while the day scrolls. */}
      <div
        role="tablist"
        aria-label="Trip days"
        className="schedule-days sticky top-0 z-20 -mx-5 grid auto-cols-[minmax(4.75rem,1fr)] grid-flow-col gap-1.5 overflow-x-auto bg-limestone/95 px-5 py-2.5 backdrop-blur-sm [scrollbar-width:none] md:mx-0 md:gap-2 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {days.map((date) => {
          const selected = date === day;
          const lead = events.find((e) => e.date === date && e.type === "golf") ?? events.find((e) => e.date === date);
          const time = lead?.teeTime ?? lead?.startTime;
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`day-tab-${date}`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => {
                const at = days.indexOf(date);
                const next = event.key === "ArrowRight" ? (at + 1) % days.length : event.key === "ArrowLeft" ? (at - 1 + days.length) % days.length : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                choose(days[next]);
                document.getElementById(`day-tab-${days[next]}`)?.focus();
              }}
              aria-controls="day-panel"
              onClick={() => choose(date)}
              className={`flex min-h-16 flex-col gap-[7px] px-2.5 pb-2 pt-[9px] text-left transition-colors duration-200 md:px-4 md:pb-3 md:pt-3 ${
                selected ? "bg-forest text-limestone" : "bg-paper text-pine hover:bg-sand/40 active:bg-sand/60"
              }`}
            >
              <span className="flex items-baseline gap-1.5">
                <span className={`text-[13px] font-semibold ${selected ? "text-mist" : "text-moss"}`}>
                  {date === today ? "Today" : weekdayShort(date)}
                </span>
                <span className="display figures text-[24px] md:text-[28px]">{Number(date.slice(8))}</span>
              </span>
              <span className={`whitespace-nowrap text-[13px] font-semibold lining-nums ${selected ? "text-copper-light" : "text-pine"}`}>
                {time ? clock(time) : " "}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="day-panel"
        role="tabpanel"
        aria-labelledby={`day-tab-${day}`}
        tabIndex={-1}
        key={day}
        className="day-panel mx-auto max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-x-14"
      >
        <header className="mt-[22px] flex items-baseline justify-between gap-3 md:mt-8 lg:col-span-2 lg:mt-10">
          <h2 className="display text-[40px] md:text-[52px] lg:text-[64px]">{day === today ? "Today" : weekday(day)}</h2>
          <p className="figures whitespace-nowrap text-label font-medium text-moss lg:text-meta">{subtitle}</p>
        </header>

        {round ? (
          <>
            <RoundTicket {...props} event={round} selected={activeStop === round.id} />
            <div className="min-w-0 lg:col-start-1 lg:mt-12">
              <RoundPlace
                {...props}
                event={round}
                stop={stops.find((s) => s.eventId === round.id) ?? null}
                stops={stops}
                activeStop={activeStop}
                onSelect={(id) => {
                  setActiveStop(id);
                  if (id) scrollTo(`schedule-event-${id}`);
                }}
                selected={activeStop === round.id}
              />
            </div>
          </>
        ) : (
          dayEvents.length === 0 && (
            <p className="serif py-10 text-[19px] italic text-moss lg:col-span-2">Nothing scheduled for this day yet.</p>
          )
        )}

        {/* Beside the map on wide screens, one paper sheet: the rest of the day, then its weather. */}
        <div className={`day-sheet min-w-0 lg:mt-12 lg:bg-paper lg:px-7 lg:pb-3 lg:pt-6 lg:[&>*:first-child]:mt-0 ${round ? "lg:col-start-2 lg:row-start-3" : "lg:col-span-2 lg:max-w-2xl"}`}>
          {rest.length > 0 && (
            <>
              {round && (
                <h3 className="display mt-9 text-[30px]">{day === today ? "Later today" : "Rest of the day"}</h3>
              )}
              <ol className={`border-t border-pine ${round ? "mt-3.5" : "mt-6"}`}>
                {rest.map((e) => (
                  <LaterEvent key={e.id} {...props} event={e} number={order(e)} selected={activeStop === e.id} />
                ))}
              </ol>
            </>
          )}

          <DayForecast
            day={day}
            weather={weather[day]}
            daylight={props.daylight[day]}
            marks={dayEvents.flatMap((e) =>
              e.startTime ? [{ id: e.id, number: order(e), title: e.title, time: e.teeTime ?? e.startTime, golf: e.type === "golf" }] : [],
            )}
            onMark={(id) => {
              setActiveStop(id);
              scrollTo(`schedule-event-${id}`);
            }}
          />

          {/* Phones close the day with the whole map; wide screens already show it beside the round. */}
          {stops.length > 0 && (
            <section id="map" aria-labelledby="day-map" className={`schedule-map mt-9 scroll-mt-28 ${round ? "lg:hidden" : ""}`}>
              <h3 id="day-map" className="display mb-4 text-[30px]">
                Property map
              </h3>
              <DayMap
                stops={stops}
                homeId={props.homePlace}
                homeLabel={props.homeLabel}
                activeEventId={activeStop}
                onSelect={(id) => {
                  setActiveStop(id);
                  if (id) scrollTo(`schedule-event-${id}`);
                }}
              />
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

type EventProps = ScheduleProps & { event: PublicEvent; selected: boolean };

const cardLabel = "text-label text-(--card-muted)";
/** A rule between a card's parts: across it on phones, between its columns on wide screens. */
const cardRule = "border-t border-(--card-rule)";

/**
 * The viewer's round: tee time, foursome and the wind at the first tee. Forest green on
 * phones, where it runs straight into the place below as one card; on wide screens a
 * paper panel across the page, in three columns.
 */
function RoundTicket(props: EventProps) {
  const { event: e, selected, states, viewerName } = props;
  const time = e.teeTime ?? e.startTime;
  const [hour, half] = time ? clock(time).split(" ") : ["", ""];
  const first = props.firstTee[e.id];
  const mine = e.teeTimes.find((t) => t.time === e.teeTime);
  // You first, then the rest of your foursome.
  const group = mine
    ? [...mine.players.filter((p) => p.name === viewerName), ...mine.players.filter((p) => p.name !== viewerName)]
    : [];
  const at = props.atStart[e.id];
  const state = states[e.id];
  const start = props.teeStarts[e.id];
  const column = "px-5 md:px-6 lg:border-l lg:border-t-0 lg:px-7 lg:py-7";

  return (
    <section
      id={`schedule-event-${e.id}`}
      aria-label={`Your round at ${e.title}`}
      data-selected={selected}
      className="schedule-event sched-card round-ticket on-forest mt-3.5 lg:col-span-2 lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1.15fr)]"
    >
      <div className="px-5 pb-5 pt-[18px] md:px-6 lg:px-7 lg:pb-7 lg:pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cardLabel}>{e.teeTime ? "Your tee time" : "Tee times begin"}</p>
          {state === "now" ? (
            <p className="text-label font-semibold text-(--card-accent)">On the course now</p>
          ) : (
            start && (
              <Countdown
                className="inline-block text-label font-semibold text-(--card-accent) first-letter:uppercase"
                target={start}
                initialNow={props.now}
                timeZone={props.timeZone}
              />
            )
          )}
        </div>
        {time ? (
          <p className="mt-2 flex items-baseline gap-2">
            <span className="display text-[84px] leading-[0.85] tracking-[-0.02em] lg:text-[96px]">{hour}</span>
            <span className="text-[18px] font-semibold">{half}</span>
          </p>
        ) : (
          <p className="serif mt-2 text-[26px]">To come</p>
        )}
        <h3 className="serif mt-3.5 text-[24px] leading-[1.15] lg:mt-5 lg:text-[28px]">{e.title}</h3>
        {first && e.teeTime && (
          <p className="mt-1 text-label text-(--card-muted) lining-nums">
            {first === clock(e.teeTime) ? "Your group is first off" : `First group off at ${first}`}
          </p>
        )}
        {props.courses[e.id] && (
          <Link
            href={props.courses[e.id]}
            className="group mt-4 flex items-center gap-3 border-t border-(--card-rule) pt-3.5 lg:mt-6 lg:pt-4"
          >
            <span className="relative block h-[38px] w-[50px] shrink-0 overflow-hidden bg-forest-deep">
              <Photo photo={props.photos[e.id]} slot={props.slots[e.id]} sizes="50px" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-meta font-semibold underline decoration-transparent decoration-1 underline-offset-4 transition-colors group-hover:decoration-(--card-accent)">
                About {e.title}
              </span>
              {props.courseFacts[e.id] && (
                <span className="mt-px block text-[13px] text-(--card-muted) lining-nums">{props.courseFacts[e.id]}</span>
              )}
            </span>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--card-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-hover:translate-x-0.5">
              <path d="M1 1l6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>

      {group.length > 0 && (
        <div className={`${cardRule} ${column} py-4`}>
          <p className={cardLabel}>Your group</p>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 lg:mt-4 lg:grid-cols-1 lg:gap-y-2.5">
            {group.map((p) => (
              <li key={p.name} className="flex items-baseline gap-1.5 text-ui font-semibold leading-[1.3] lg:text-[19px]">
                {p.name}
                {p.name === viewerName && <span className="text-[12px] font-semibold text-(--card-accent)">You</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${cardRule} ${column} py-4`}>
        <p className={cardLabel}>At the first tee</p>
        {at ? (
          <dl className="figures mt-3 grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)] items-end lg:mt-5 lg:grid-cols-2 lg:gap-y-5">
            <div className="flex items-center gap-3 lg:col-span-2">
              <Compass from={degreesOf(at.direction)} size={46} label={`Wind from the ${at.direction}`} />
              <div>
                <dt className="whitespace-nowrap text-[13px] text-(--card-muted)">
                  Wind <span className="font-semibold text-(--card-accent)">{at.direction}</span>
                </dt>
                <Figure value={at.speed} unit="mph" />
              </div>
            </div>
            <div className="border-l border-(--card-rule) pl-3.5 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-4">
              <dt className="text-[13px] text-(--card-muted)">Gusts</dt>
              <Figure value={at.gust} unit="mph" />
            </div>
            <div className="border-l border-(--card-rule) pl-3.5 lg:border-t lg:pt-4">
              <dt className="text-[13px] text-(--card-muted)">Temp</dt>
              <Figure value={`${at.temp}°`} />
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-meta text-(--card-muted)">The forecast for your tee time appears about two weeks out.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Where the round is, and the way there from the viewer's room. On phones it closes the
 * round's card with a small map of just that walk; on wide screens it opens onto the page
 * with the whole day on a large map, numbered as in the list beside it.
 */
function RoundPlace(
  props: EventProps & { stop: MapStop | null; stops: MapStop[]; activeStop: string | null; onSelect: (id: string | null) => void },
) {
  const { event: e, stop } = props;
  return (
    <section aria-label={`Where: ${props.where[e.id] ?? e.title}`} className="sched-card on-forest">
      <div className={`${cardRule} px-5 pb-3.5 pt-4 md:px-6 lg:border-t-0 lg:px-0 lg:pt-0`}>
        <p className={cardLabel}>Where</p>
        <p className="mt-1.5 text-ui font-semibold leading-[1.35] lg:font-serif lg:text-[24px] lg:font-normal lg:leading-[1.2]">
          {props.where[e.id] ?? e.venue ?? e.title}
        </p>
        {props.homeLabel && stop && <p className="mt-0.5 text-label text-(--card-muted) lg:mt-1">From {props.homeLabel}</p>}
      </div>
      {stop && (
        <>
          <div className="lg:hidden">
            <DayMap
              compact
              stops={[stop]}
              homeId={props.homePlace}
              homeLabel={props.homeLabel}
              activeEventId={null}
              onSelect={() => document.getElementById("map")?.scrollIntoView({ behavior: reduceMotion() ? "instant" : "smooth", block: "start" })}
            />
          </div>
          <div className="hidden lg:mt-1 lg:block">
            <DayMap
              compact
              stops={props.stops}
              homeId={props.homePlace}
              homeLabel={props.homeLabel}
              activeEventId={props.activeStop}
              onSelect={props.onSelect}
            />
          </div>
        </>
      )}
      <div className={`${cardRule} flex items-center justify-between gap-3 px-5 py-0.5 md:px-6 lg:border-t-0 lg:px-0 lg:pt-1`}>
        <a
          href={`tel:${props.shuttle.replace(/\D/g, "")}`}
          className="inline-flex min-h-11 items-center whitespace-nowrap text-meta font-semibold lining-nums underline decoration-sand decoration-1 underline-offset-[5px] transition-colors hover:decoration-(--card-accent)"
        >
          Shuttle {props.shuttle}
        </a>
        {stop && (
          <a href="#map" className="group inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-meta font-semibold lg:hidden">
            Property map
            <ArrowRight size={14} />
          </a>
        )}
        <p className="hidden text-fine text-moss lg:block">Stops in itinerary order. Lines are not walking routes.</p>
      </div>
    </section>
  );
}

/** Everything after the round: when, where, with whom, and the weather for outdoor stops. */
function LaterEvent(props: EventProps & { number: number }) {
  const { event: e, number, selected, states } = props;
  const time = e.teeTime ?? e.startTime;
  const [hour, half] = time ? clock(time).split(" ") : ["", ""];
  const dining = e.type === "dining";
  // Dinner is indoors: no forecast for it.
  const at = dining ? undefined : props.atStart[e.id];
  const party = e.type === "golf" ? [] : (props.party[e.id] ?? []);
  const state = states[e.id];

  return (
    <li
      id={`schedule-event-${e.id}`}
      data-selected={selected}
      data-past={state === "past"}
      className={`schedule-event grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 border-b border-rule py-4 ${state === "past" ? "opacity-60" : ""}`}
    >
      <div>
        {time ? (
          <>
            <span className="display figures block text-[30px] leading-none">{hour}</span>
            <span className="mt-1 block text-[13px] font-semibold">{half}</span>
          </>
        ) : (
          <span className="block text-[13px] font-semibold text-moss">All day</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`figures flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-paper ${
              e.type === "golf" ? "bg-forest-deep" : "bg-copper"
            }`}
          >
            {number}
          </span>
          <h4 className="serif text-[21px] leading-[1.2]">{e.title}</h4>
          {state === "now" && <span className="text-label font-semibold text-copper">Now</span>}
        </div>
        <p className="mt-1 text-label leading-[1.4] text-moss">{props.where[e.id] ?? e.venue ?? e.title}</p>
        {party.length > 0 && <p className="mt-1.5 text-label leading-[1.4]">With {firstNames(party)}</p>}
        {at && (
          <p className="figures mt-1.5 flex items-center gap-1.5 text-label font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-moss)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9h10.500a2.500 2.500 0 1 0-2.500-2.500M3 13h15a2.500 2.500 0 1 1-2.500 2.500M3 17h7" />
            </svg>
            {at.temp}° · {at.speed} mph {at.direction}
            {at.gust > at.speed && ` · gusts ${at.gust}`}
          </p>
        )}
        {dining && e.partySize && <p className="mt-1.5 text-label font-semibold">Reservation · party of {e.partySize}</p>}
        {e.reservationNote && <p className="mt-1 text-label text-moss">{e.reservationNote}</p>}
        {props.lateNote[e.id] && <p className="figures mt-1.5 text-label font-semibold text-copper">{props.lateNote[e.id]}</p>}
      </div>
    </li>
  );
}

/** A small line icon for the forecast. */
const ForecastIcon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--card-muted, var(--color-mist))" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** The hours the daylight bar covers, as a 24-hour clock. */
const DAWN = 6;
const DUSK = 20;
/** Where a time of day ("07:15") sits along the bar, 0 to 100. */
const along = (time: string) => {
  const hours = Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
  return Math.max(0, Math.min(100, ((hours - DAWN) / (DUSK - DAWN)) * 100));
};

/**
 * The day's general forecast, closing the day: wind, gusts, high and low, rain, then a
 * bar of the day's light with each stop marked on it by its number.
 */
function DayForecast({ day, weather, daylight, marks, onMark }: {
  day: string;
  weather?: DayWeather;
  daylight?: { sunrise: string; sunset: string; rise: string; set: string };
  marks: { id: string; number: number; title: string; time: string; golf: boolean }[];
  onMark: (id: string) => void;
}) {
  const title = `${weekday(day)}’s weather`;
  if (!weather) {
    return (
      <>
        <h3 className="display mt-14 hidden text-[30px] lg:block lg:mt-10">{title}</h3>
        <section aria-label={title} className="sched-card on-forest mt-9 px-5 py-4 lg:mt-3.5 lg:border-t lg:border-pine lg:px-0">
          <p className="text-label text-(--card-muted) lg:hidden">{title}</p>
          <p className="mt-2 text-meta text-(--card-muted) lg:mt-0">No forecast for this day yet. It appears about two weeks out.</p>
        </section>
      </>
    );
  }
  return (
    <>
    <div className="mt-14 hidden items-baseline justify-between gap-4 lg:mt-10 lg:flex">
      <h3 className="display text-[30px]">{title}</h3>
      <p className="flex items-center gap-1.5 whitespace-nowrap text-label text-moss">
        <WeatherGlyph kind={weather.kind} size={18} />
        {weather.label}
      </p>
    </div>
    <section aria-label={title} className="sched-card on-forest mt-9 lg:mt-3.5 lg:border-t lg:border-pine">
      <div className="px-5 pb-[18px] pt-4 lg:px-0 lg:pt-5">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="text-label text-(--card-muted)">{title}</p>
          <p className="flex items-center gap-1.5 whitespace-nowrap text-label text-(--card-muted)">
            <WeatherGlyph kind={weather.kind} size={18} />
            {weather.label}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-5 lg:mt-0">
          {weather.windFrom !== null && (
            <Compass from={weather.windFrom} size={64} label={`Wind from the ${compass(weather.windFrom)}`} />
          )}
          <dl className="figures grid min-w-0 flex-1 grid-cols-2">
            <div className="pb-3">
              <dt className="whitespace-nowrap text-[13px] text-(--card-muted)">
                Wind{weather.windFrom !== null && <span className="font-semibold text-(--card-accent)"> {compass(weather.windFrom)}</span>}
              </dt>
              <Figure value={weather.wind} unit="mph" />
            </div>
            <div className="border-l border-(--card-rule) pb-3 pl-3.5">
              <dt className="text-[13px] text-(--card-muted)">Gusts</dt>
              {weather.gust !== null ? <Figure value={weather.gust} unit="mph" /> : <Figure value="–" />}
            </div>
            <div className="border-t border-(--card-rule) pt-3">
              <dt className="text-[13px] text-(--card-muted)">High / low</dt>
              <dd className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="display text-[30px] leading-none">{weather.high}°</span>
                <span className="text-meta font-semibold text-(--card-muted)">{weather.low}°</span>
              </dd>
            </div>
            <div className="border-l border-t border-(--card-rule) pl-3.5 pt-3">
              <dt className="text-[13px] text-(--card-muted)">Rain</dt>
              {weather.rainChance !== null ? <Figure value={weather.rainChance} unit="%" /> : <Figure value="–" />}
            </div>
          </dl>
        </div>
      </div>

      {daylight && (
        <div className="border-t border-(--card-rule) px-5 pb-[22px] pt-3.5 lg:px-0">
          <div className="figures flex justify-between text-label font-semibold">
            <p className="flex items-center gap-2">
              <ForecastIcon d="M1.500 12.500h13M4 12.500a4 4 0 0 1 8 0M8 6V2.500M5.800 4.300 8 2.200l2.200 2.100M2.600 8.300l1.200.900M13.400 8.300l-1.200.900" />
              <span className="sr-only">Sunrise </span>
              {daylight.sunrise}
            </p>
            <p className="flex items-center gap-2">
              <ForecastIcon d="M1.500 12.500h13M4 12.500a4 4 0 0 1 8 0M8 2.200v3.500M5.800 3.900 8 6l2.200-2.100M2.600 8.300l1.200.900M13.400 8.300l-1.200.900" />
              <span className="sr-only">Sunset </span>
              {daylight.sunset}
            </p>
          </div>
          <div className="relative mt-3 h-2 bg-(--card-track)">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 bg-sand"
              style={{ left: `${along(daylight.rise)}%`, right: `${100 - along(daylight.set)}%` }}
            />
            {marks.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onMark(m.id)}
                aria-label={`${m.title}, ${clock(m.time)}`}
                title={`${m.title} · ${clock(m.time)}`}
                className="group absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${along(m.time)}%` }}
              >
                <span
                  className={`figures flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold shadow-[0_0_0_3px_var(--card-ring)] transition-transform group-hover:scale-110 ${
                    m.golf ? "bg-(--mark-golf-bg) text-(--mark-golf-fg)" : "bg-copper text-paper"
                  }`}
                >
                  {m.number}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 border-t border-(--card-rule) px-5 py-1 lg:px-0">
        <Link href={`/wind?day=${day}`} className="group inline-flex min-h-11 items-center gap-3 text-meta font-semibold">
          <span className="underline decoration-sand decoration-1 underline-offset-[6px] transition-colors group-hover:decoration-(--card-accent)">
            Hourly Wind Map
          </span>
          <ArrowRight />
        </Link>
        <p className="text-fine text-(--card-muted)">
          Forecast by{" "}
          <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
        </p>
      </div>
    </section>
    </>
  );
}
