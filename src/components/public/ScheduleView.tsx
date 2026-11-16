"use client";

import Link from "next/link";
import { useState } from "react";
import { clock, monthDay, weekday, weekdayShort } from "@/lib/time";
import type { PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { compass, type ForecastAt } from "@/lib/windMath";
import { DayMap, type MapStop } from "./DayMap";
import { TypeMark, type RoundInfo } from "./features";
import { WeatherGlyph, WindGlyph } from "./Glyphs";
import { Photo, PhotoCredit, type PhotoData } from "./Photo";
import { TripHeading } from "./TripHeading";

export type ScheduleProps = {
  trip: { title: string; location: string; dates: string };
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
  /** The viewer's full name, to leave them out of their own foursome */
  viewerName: string | null;
  initialDay: string;
  today: string | null;
};

export function ScheduleView(props: ScheduleProps) {
  const { trip, days, events, weather, today } = props;
  const [day, setDay] = useState(props.initialDay);
  const dayEvents = events.filter((e) => e.date === day);
  const dayWeather = weather[day];
  const [activeStop, setActiveStop] = useState<string | null>(null);
  const stops: MapStop[] = dayEvents
    .filter((e) => props.places[e.id])
    .map((e, i) => ({
      eventId: e.id,
      number: i + 1,
      title: e.title,
      time: e.startTime ? clock(e.startTime) : "All day",
      type: e.type,
      placeId: props.places[e.id],
    }));

  const choose = (date: string) => {
    setDay(date);
    setActiveStop(null);
    const url = new URL(window.location.href);
    url.searchParams.set("day", date);
    window.history.replaceState(null, "", url);
  };

  const selectEvent = (id: string | null, target: "event" | "map" = "event") => {
    setActiveStop(id);
    if (!id) return;
    const element = document.getElementById(target === "map" ? "schedule-map" : `schedule-event-${id}`);
    if (target === "event" || window.matchMedia("(max-width: 1023px)").matches) {
      element?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
  };

  return (
    <div className="schedule-page mx-auto max-w-6xl px-5 pb-16 pt-20 md:px-10 md:pt-32">
      <TripHeading title="Schedule" dates={trip.dates} />

      {/* Day picker: stays within reach while the day's events scroll. */}
      <div
        role="tablist"
        aria-label="Trip days"
        className="schedule-days sticky top-0 z-20 -mx-5 mt-6 flex gap-1.5 overflow-x-auto bg-limestone/95 px-5 py-3 backdrop-blur-sm [scrollbar-width:none] md:mx-0 md:gap-2 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {days.map((date) => {
          const selected = date === day;
          const w = weather[date];
          const count = events.filter((e) => e.date === date).length;
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`day-tab-${date}`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={event => {
                const at = days.indexOf(date);
                const next = event.key === "ArrowRight" ? (at + 1) % days.length : event.key === "ArrowLeft" ? (at - 1 + days.length) % days.length : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                choose(days[next]);
                document.getElementById(`day-tab-${days[next]}`)?.focus();
              }}
              aria-controls="day-panel"
              onClick={() => choose(date)}
              className={`group relative flex min-h-[4.25rem] min-w-[4.6rem] flex-1 items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors duration-200 md:px-5 md:py-3.5 ${
                selected
                  ? "bg-forest text-limestone"
                  : "bg-paper text-pine hover:bg-sand/40 active:bg-sand/60"
              }`}
            >
              <span>
                <span className={`block text-label font-semibold ${selected ? "text-mist" : "text-moss"}`}>
                  {date === today ? "Today" : weekdayShort(date)}
                </span>
                <span className="display figures mt-0.5 block text-[28px] md:text-[34px]">
                  {Number(date.slice(8))}
                </span>
              </span>
              <span className={`hidden text-right text-label sm:block ${selected ? "text-limestone" : "text-moss"}`}>
                {w && (
                  <span className="figures flex items-center justify-end gap-1.5 font-semibold">
                    <WeatherGlyph kind={w.kind} size={18} />
                    {w.high}°
                  </span>
                )}
                <span className="mt-1 block">
                  {count} {count === 1 ? "event" : "events"}
                </span>
              </span>
              {date === today && (
                <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-copper sm:hidden" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
        <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${day}`} tabIndex={0} key={day} className="day-panel min-w-0">
          <header className="flex items-end justify-between gap-4">
            <h2 className="display text-[44px] md:text-[60px]">{weekday(day)}</h2>
            <p className="pb-1.5 text-right text-meta font-medium text-moss">
              {monthDay(day)}
            </p>
          </header>

          {/* The selected day's conditions, right where the day begins. */}
          <DayForecast
            day={day}
            weather={dayWeather}
            daylight={props.daylight[day]}
            marks={dayEvents.flatMap((e) => {
              const stop = stops.find((x) => x.eventId === e.id);
              return stop && e.startTime ? [{ id: e.id, number: stop.number, title: e.title, time: e.startTime, golf: e.type === "golf" }] : [];
            })}
            onMark={(id) => selectEvent(id)}
          />

          {dayEvents.length === 0 ? (
            <p className="serif py-10 text-[19px] italic text-moss">Nothing scheduled for this day yet.</p>
          ) : (
            <ol className="mt-6 space-y-3">
              {dayEvents.map((e) =>
                e.type === "golf" ? (
                  <GolfEvent key={e.id} event={e} {...props} selected={activeStop === e.id} />
                ) : (
                  <PlainEvent key={e.id} event={e} {...props} selected={activeStop === e.id} />
                ),
              )}
            </ol>
          )}
        </section>

        {/* A slim rail on wide screens; on phones it closes the day as a short footer. */}
        <aside id="map" className="scroll-mt-28 lg:sticky lg:top-24 lg:self-start">
          {stops.length > 0 && (
            <section id="schedule-map" aria-labelledby="day-map" className="schedule-map mb-8">
              <h2 id="day-map" className="display mb-4 text-[30px]">
                Property Map
              </h2>
              <DayMap
                stops={stops}
                homeId={props.homePlace}
                homeLabel={props.homeLabel}
                activeEventId={activeStop}
                onSelect={id => selectEvent(id)}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** A small line icon for the forecast. */
const ForecastIcon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
 * The day's forecast, on forest green so it stands apart from the stops: the wind first,
 * then the rest of the weather, and a bar of the day's light with each stop marked on it
 * by the number it has on the map.
 */
function DayForecast({ day, weather, daylight, marks, onMark }: {
  day: string;
  weather?: DayWeather;
  daylight?: { sunrise: string; sunset: string; rise: string; set: string };
  marks: { id: string; number: number; title: string; time: string; golf: boolean }[];
  onMark: (id: string) => void;
}) {
  if (!weather) {
    return (
      <div className="on-forest mt-4 bg-forest p-5 text-meta text-mist md:p-6">
        No forecast for this day yet. It appears about two weeks out.
      </div>
    );
  }
  const stats: [string, string, React.ReactNode][] = [
    ["Gusts", weather.gust !== null ? `${weather.gust} mph` : "None", <WindGlyph key="i" size={16} />],
    ["High / low", `${weather.high}° / ${weather.low}°`, <WeatherGlyph key="i" kind={weather.kind} size={16} />],
    ["Rain", weather.rainChance !== null ? `${weather.rainChance}%` : "n/a", <ForecastIcon key="i" d="M8 2.200c2.400 2.900 3.800 5 3.800 6.900a3.800 3.800 0 0 1-7.600 0C4.200 7.200 5.600 5.100 8 2.200Z" />],
  ];
  return (
    <section aria-label={`${weekday(day)}’s forecast`} className="on-forest mt-4 divide-y divide-rule-light bg-forest text-limestone">
      <div className="px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            {weather.windFrom !== null && (
              <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0" role="img" aria-label={`Wind from the ${compass(weather.windFrom)}`}>
                <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeOpacity=".28" />
                <path d="M26 3v3M49 26h-3M26 49v-3M3 26h3" stroke="currentColor" strokeOpacity=".5" />
                <text x="26" y="13.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="currentColor" fillOpacity=".75">N</text>
                <path d="M26 16L32 34L26 30L20 34Z" fill="var(--color-copper-light)" transform={`rotate(${weather.windFrom + 180} 26 26)`} />
              </svg>
            )}
            <p className="flex items-center gap-3">
              <span className="display text-[52px] leading-none">{weather.wind}</span>
              <span className="text-ui font-semibold leading-snug">
                mph
                {weather.windFrom !== null && <span className="block font-normal text-mist">from {compass(weather.windFrom)}</span>}
              </span>
            </p>
          </div>
          <dl className="flex divide-x divide-rule-light">
            {stats.map(([name, value, icon]) => (
              <div key={name} className="px-4 first:pl-0 last:pr-0">
                <dt className="flex items-center gap-1.5 whitespace-nowrap text-label text-mist">
                  {icon}
                  {name}
                </dt>
                <dd className="figures mt-1 whitespace-nowrap text-ui font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {daylight && (
        <div className="px-5 pb-6 pt-4 md:px-6">
          {/* Sunrise and sunset stand over their ends of the lit stretch where there is room. */}
          <div className="figures relative flex justify-between gap-4 text-meta font-semibold sm:block sm:h-6">
            <p className="flex items-center gap-2 sm:absolute sm:whitespace-nowrap" style={{ left: `${along(daylight.rise)}%` }}>
              <span className="text-mist"><ForecastIcon d="M1.500 12.500h13M4 12.500a4 4 0 0 1 8 0M8 6V2.500M5.800 4.300 8 2.200l2.200 2.100M2.600 8.300l1.200.900M13.400 8.300l-1.200.900" /></span>
              <span className="sr-only">Sunrise </span>
              {daylight.sunrise}
            </p>
            <p className="flex items-center gap-2 sm:absolute sm:-translate-x-full sm:whitespace-nowrap" style={{ left: `${along(daylight.set)}%` }}>
              <span className="text-mist"><ForecastIcon d="M1.500 12.500h13M4 12.500a4 4 0 0 1 8 0M8 2.200v3.500M5.800 3.900 8 6l2.200-2.100M2.600 8.300l1.200.900M13.400 8.300l-1.200.900" /></span>
              <span className="sr-only">Sunset </span>
              {daylight.sunset}
            </p>
          </div>
          <div className="relative mt-3 h-2 bg-limestone/15">
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
                  className={`figures flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold shadow-[0_0_0_3px_var(--color-forest)] transition-transform group-hover:scale-110 ${
                    m.golf ? "bg-paper text-forest-deep" : "bg-copper text-paper"
                  }`}
                >
                  {m.number}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5 md:px-6">
        <Link href={`/wind?day=${day}`} className="group inline-flex min-h-11 items-center gap-3 text-ui font-semibold">
          <span className="underline decoration-sand decoration-1 underline-offset-[6px] transition-colors group-hover:decoration-copper-light">
            Hourly Wind Map
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            <path d="M4 12h15m-6-6 6 6-6 6" />
          </svg>
        </Link>
        <p className="text-fine text-mist">
          Forecast by{" "}
          <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
        </p>
      </div>
    </section>
  );
}

type EventProps = ScheduleProps & { event: PublicEvent; selected: boolean };

const label = "text-label font-medium text-moss";

/**
 * What every stop answers. On the left, when: the time in large figures (for a round,
 * the viewer's own tee time, with the whole trip's first group named apart from it) and
 * the forecast for that moment. On the right, with whom and where.
 */
function StopFacts({ event: e, atStart, lateNote, where, party, firstTee, viewerName, courses }: EventProps) {
  const golf = e.type === "golf";
  const mine = golf ? e.teeTimes.find((t) => t.time === e.teeTime) : undefined;
  const withWhom = golf
    ? (mine?.players.map((p) => p.name).filter((name) => name !== viewerName) ?? [])
    : (party[e.id] ?? []);
  const time = e.teeTime ?? e.startTime;
  const [hour, half] = time ? clock(time).split(" ") : ["", ""];
  const first = firstTee[e.id];
  // Dinner is indoors: no forecast for it.
  const at = e.type === "dining" ? undefined : atStart[e.id];
  const forecast: [string, string][] = at
    ? [
        [golf ? "At tee time" : "At the start", `${at.temp}°`],
        ["Wind", `${at.speed} mph ${at.direction}`],
        ...(at.gust > at.speed ? ([["Gusts", `${at.gust} mph`]] as [string, string][]) : []),
      ]
    : [];

  return (
    <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
      <div className="px-5 py-5 md:px-7 md:py-6">
        <p className={label}>{golf ? (e.teeTime ? "Your tee time" : "Tee time") : e.type === "dining" ? "Reservation" : "Starts"}</p>
        {time ? (
          <p className="mt-1 flex items-baseline gap-2">
            <span className="display text-[clamp(3.25rem,13vw,4.75rem)] leading-none">{hour}</span>
            <span className="text-ui font-semibold">{half}</span>
          </p>
        ) : (
          <p className="serif mt-2 text-[26px]">To come</p>
        )}
        {golf && first && e.teeTime && (
          <p className="figures mt-3 text-meta text-moss">
            {first === clock(e.teeTime) ? (
              "Your group is first off"
            ) : (
              <>
                First group off at <span className="font-semibold text-pine">{first}</span>
              </>
            )}
          </p>
        )}
        {lateNote[e.id] && <p className="mt-3 text-meta font-semibold text-copper">{lateNote[e.id]}</p>}
        {forecast.length > 0 && (
          <dl className="figures mt-4 divide-y divide-rule border-t border-rule text-meta">
            {forecast.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-moss">{name}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="divide-y divide-rule border-t border-rule md:border-l md:border-t-0">
        {(withWhom.length > 0 || e.partySize) && (
          <div className="px-5 py-5 md:px-7 md:py-6">
            <p className={label}>With</p>
            {withWhom.length > 0 ? (
              <ul className="mt-2 space-y-1 text-ui font-semibold">
                {withWhom.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ui font-semibold">Party of {e.partySize}</p>
            )}
          </div>
        )}
        <div className="px-5 py-5 md:px-7 md:py-6">
          <p className={label}>Where</p>
          <p className="mt-2 text-ui font-semibold">{where[e.id] ?? e.venue ?? e.title}</p>
          {courses[e.id] && (
            <Link
              href={courses[e.id]}
              className="group mt-4 inline-flex min-h-10 items-center gap-2 bg-forest px-3.5 text-label font-semibold text-limestone transition-colors hover:bg-forest-deep"
            >
              About the course
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Golf leads the day: the course's photograph, then the same four answers as any stop. */
function GolfEvent(props: EventProps) {
  const { event: e, photos, slots, states, selected } = props;
  const state = states[e.id];
  return (
    <li id={`schedule-event-${e.id}`} className="schedule-event" data-selected={selected} data-past={state === "past"}>
      {/* The photograph carries only the name. The answers sit below it in dark type on
          paper, where they can be read in any light. */}
      <div className="relative isolate aspect-[16/10] overflow-hidden bg-forest-deep text-paper sm:aspect-[16/7]">
        <Photo photo={photos[e.id]} slot={slots[e.id]} sizes="(min-width: 1152px) 800px, 100vw" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(13 33 27 / 0.92) 0%, rgb(13 33 27 / 0.7) 30%, rgb(13 33 27 / 0) 68%), linear-gradient(to bottom, rgb(13 33 27 / 0.55) 0%, rgb(13 33 27 / 0) 26%)",
          }}
        />
        {state === "now" && (
          <span className="absolute right-5 top-5 bg-copper px-2 py-0.5 text-meta font-semibold text-paper md:right-7 md:top-7">Now</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
          <h3 className="display text-[clamp(2.5rem,8vw,4rem)] [text-shadow:0_1px_14px_rgb(13_33_27/0.55)]">{e.title}</h3>
          <PhotoCredit photo={photos[e.id]} className="mt-1 block" />
        </div>
      </div>
      <div className="bg-paper">
        <StopFacts {...props} />
      </div>
    </li>
  );
}

/** Meals and everything else: a small photograph and name, then the same four answers. */
function PlainEvent(props: EventProps) {
  const { event: e, photos, slots, states, selected } = props;
  const state = states[e.id];
  const photo = photos[e.id];
  return (
    <li id={`schedule-event-${e.id}`} className="schedule-event bg-paper" data-selected={selected} data-past={state === "past"}>
      <div className="flex items-center gap-4 border-b border-rule p-4 md:px-7 md:py-5">
        {photo ? (
          <span className="relative block h-14 w-14 shrink-0 overflow-hidden bg-forest-deep">
            <Photo photo={photo} slot={slots[e.id]} sizes="56px" />
          </span>
        ) : (
          <TypeMark type={e.type} />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="serif text-[23px] leading-tight md:text-[26px]">{e.title}</h3>
          <p className="mt-0.5 text-meta text-moss">
            {state === "now" && <span className="mr-2 font-semibold text-copper">Now</span>}
            {e.type === "dining" ? "Dinner" : "Activity"}
          </p>
        </div>
      </div>
      {(e.description || e.reservationNote) && (
        <div className="border-b border-rule px-5 py-3.5 text-ui md:px-7">
          {e.description && <p className="serif max-w-prose whitespace-pre-line text-[18px] leading-relaxed">{e.description}</p>}
          {e.reservationNote && <p className="text-meta text-moss">{e.reservationNote}</p>}
        </div>
      )}
      <StopFacts {...props} />
    </li>
  );
}
