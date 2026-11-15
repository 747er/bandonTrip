"use client";

import Link from "next/link";
import { useState } from "react";
import { directionsUrl } from "@/lib/links";
import { clock, monthDay, weekday, weekdayShort } from "@/lib/time";
import { eventTimes, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { DayMap, type MapStop } from "./DayMap";
import { eventSummary } from "./EventList";
import { Conditions, TypeMark, type RoundInfo } from "./features";
import { WeatherGlyph, WindGlyph } from "./Glyphs";
import { Photo, PhotoCredit, type PhotoData } from "./Photo";

export type ScheduleProps = {
  trip: { slug: string; title: string; location: string; dates: string };
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
  /** Forecast at each event's start hour, as a short line of text */
  atStart: Record<string, string>;
  /** A note for outdoor events that run past sunset */
  lateNote: Record<string, string>;
  /** Sunrise and sunset per date, already formatted */
  daylight: Record<string, { sunrise: string; sunset: string }>;
  /** Resort-map place id per event id, for events the map can show */
  places: Record<string, string>;
  /** Place id of where the group is staying, if it is on the map */
  homePlace: string | null;
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
  const otherPlaces = [...new Set(Object.values(props.places))];

  const choose = (date: string) => {
    setDay(date);
    setActiveStop(null);
    const url = new URL(window.location.href);
    url.searchParams.set("day", date);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 md:px-10 md:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h1 className="display text-[clamp(2.75rem,11vw,4.5rem)]">Schedule</h1>
        <p className="pb-1.5 text-meta text-moss">
          {trip.dates}
        </p>
      </div>

      {/* Day picker: stays within reach while the day's events scroll. */}
      <div
        role="tablist"
        aria-label="Trip days"
        className="sticky top-0 z-20 -mx-5 mt-6 flex gap-1.5 overflow-x-auto bg-limestone/95 px-5 py-3 backdrop-blur-sm [scrollbar-width:none] md:mx-0 md:gap-2 md:px-0 [&::-webkit-scrollbar]:hidden"
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
        <section id="day-panel" role="tabpanel" aria-label={weekday(day)} key={day} className="day-panel min-w-0">
          <header className="flex items-end justify-between gap-4">
            <h2 className="display text-[44px] md:text-[60px]">{weekday(day)}</h2>
            <p className="pb-1.5 text-right text-meta font-medium text-moss">
              {monthDay(day)}
            </p>
          </header>

          {/* The selected day's conditions, right where the day begins. */}
          <div className="mt-4 border-y border-pine py-4">
            {dayWeather ? (
              <>
                <Conditions weather={dayWeather} tone="light" className="sm:justify-start sm:gap-x-12" />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  {props.daylight[day] && (
                    <p className="figures text-meta font-medium">
                      Sunrise {props.daylight[day].sunrise}, sunset {props.daylight[day].sunset}
                    </p>
                  )}
                  <Link
                    href={`/t/${trip.slug}/weather?day=${day}`}
                    className="inline-flex min-h-11 items-center gap-2 bg-forest px-4 text-meta font-semibold text-limestone transition-colors hover:bg-forest-deep"
                  >
                    <WindGlyph size={17} />
                    Wind map
                  </Link>
                </div>
                <p className="mt-3 text-fine text-moss">
                  Forecast for {trip.location || "the trip"} by{" "}
                  <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                    Open-Meteo
                  </a>
                </p>
              </>
            ) : (
              <p className="text-meta text-moss">No forecast for this day yet. It appears about two weeks out.</p>
            )}
          </div>

          {dayEvents.length === 0 ? (
            <p className="serif py-10 text-[19px] italic text-moss">Nothing scheduled for this day yet.</p>
          ) : (
            <ol className="mt-6 space-y-3">
              {dayEvents.map((e) =>
                e.type === "golf" ? (
                  <GolfEvent key={e.id} event={e} {...props} />
                ) : (
                  <PlainEvent key={e.id} event={e} {...props} />
                ),
              )}
            </ol>
          )}
        </section>

        {/* A slim rail on wide screens; on phones it closes the day as a short footer. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {stops.length > 0 && (
            <section aria-labelledby="day-map" className="mb-8">
              <h2 id="day-map" className="display mb-3 text-[30px] lg:sr-only">
                Where we&rsquo;ll be
              </h2>
              <DayMap
                stops={stops}
                homeId={props.homePlace}
                otherPlaceIds={otherPlaces}
                dayName={weekday(day)}
                activeEventId={activeStop}
                onSelect={setActiveStop}
              />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

type EventProps = ScheduleProps & { event: PublicEvent };

function Actions({ event, course }: { event: PublicEvent; course?: string }) {
  if (!event.venue && !event.address && !course) return null;
  return (
    <div className="flex flex-wrap gap-x-7">
      {(event.venue || event.address) && (
        <a className="action" href={directionsUrl(event)} target="_blank" rel="noreferrer">
          Get directions
        </a>
      )}
      {course && (
        <Link className="action" href={course}>
          About the course
        </Link>
      )}
    </div>
  );
}

function Details({ event: e }: { event: PublicEvent }) {
  const teeTimes = e.teeTimes.filter((t) => t.players.length > 0 || t.note);
  const rows: [string, string][] = [];
  if (e.venue && e.venue !== e.title) rows.push(["Where", e.venue]);
  if (e.address) rows.push(["Address", e.address]);
  if (e.partySize) rows.push(["Party", `${e.partySize}`]);
  if (e.reservationNote) rows.push(["Reservation", e.reservationNote]);
  if (e.group) rows.push(["Who", e.group]);

  return (
    <div className="flex flex-col gap-4 text-ui">
      {e.description && <p className="serif max-w-prose whitespace-pre-line text-[18px] leading-relaxed">{e.description}</p>}
      {rows.length > 0 && (
        <dl className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-24 shrink-0 pt-0.5 text-label text-moss">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {teeTimes.length > 0 && (
        <table className="order-first w-full max-w-lg">
          <caption className="sr-only">Tee times</caption>
          <tbody className="divide-y divide-rule border-y border-rule">
            {teeTimes.map((t) => (
              <tr key={t.time}>
                <th scope="row" className="figures w-24 py-2.5 text-left align-top font-semibold">
                  {clock(t.time)}
                </th>
                <td className="py-2.5">
                  {t.players.map((p, i) => (
                    <span key={p.name} className={p.ours ? "font-semibold" : "text-moss"}>
                      {p.name}
                      {i < t.players.length - 1 && ", "}
                    </span>
                  ))}
                  {t.note && <span className="block text-moss">{t.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const Toggle = () => (
  <svg
    className="toggle shrink-0"
    width="20"
    height="20"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M9 3v12M3 9h12" />
  </svg>
);

/** Golf leads the day: the course's photograph, round and tee times up front. */
function GolfEvent({ event: e, photos, slots, rounds, states, atStart, courses }: EventProps) {
  const round = rounds[e.id];
  const state = states[e.id];
  return (
    <li className={state === "past" ? "opacity-60" : ""}>
      {/* The photograph carries only the name. Times and conditions sit below it in dark
          type on paper, where they can be read in any light. */}
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
        <div className="absolute inset-x-0 top-0 flex justify-between p-5 text-meta font-semibold md:p-7">
          <span>{round ? `Round ${round.number} of ${round.total}` : "Golf"}</span>
          {state === "now" && <span className="bg-copper px-2 py-0.5 text-paper">Now</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
          <h3 className="display text-[clamp(2.5rem,8vw,4rem)] [text-shadow:0_1px_14px_rgb(13_33_27/0.55)]">{e.title}</h3>
          <PhotoCredit photo={photos[e.id]} className="mt-1 block" />
        </div>
      </div>
      <div className="bg-paper">
        <div className="border-b border-rule px-5 py-4 md:px-7">
          <p className="figures text-fact font-semibold">
            {e.startTime ? (
              <>
                <span className="mr-2 text-ui font-medium text-moss">Tee times</span>
                {eventTimes(e)}
              </>
            ) : (
              "Tee times to come"
            )}
          </p>
          {atStart[e.id] && (
            <p className="figures mt-1.5 text-meta">
              <span className="text-moss">At the first tee time </span>
              <span className="font-semibold">{atStart[e.id]}</span>
            </p>
          )}
        </div>
        <div className="px-5 md:px-7">
          <Actions event={e} course={courses[e.id]} />
        </div>
        <details className="event border-t border-rule" open={e.teeTimes.length > 0}>
          <summary className="flex min-h-14 items-center justify-between gap-4 px-5 text-ui font-semibold md:px-7">
            Pairings and details <Toggle />
          </summary>
          <div className="event-body px-5 pb-5 pt-1 md:px-7">
            <Details event={e} />
            {e.teeTimes.every((t) => t.players.length === 0 && !t.note) && (
              <p className="mt-3 text-meta text-moss">Pairings will appear here once they are set.</p>
            )}
          </div>
        </details>
      </div>
    </li>
  );
}

/** Meals and everything else: a compact row that opens for details. */
function PlainEvent({ event: e, photos, slots, states, atStart, lateNote }: EventProps) {
  const state = states[e.id];
  const photo = photos[e.id];
  return (
    <li className={state === "past" ? "opacity-60" : ""}>
      <details className={`event border-l-[3px] bg-paper ${e.type === "dining" ? "border-copper" : "border-moss"}`}>
        <summary className="flex min-h-[5rem] items-center gap-4 p-4 md:px-5">
          {photo ? (
            <span className="relative block h-14 w-14 shrink-0 overflow-hidden bg-forest-deep">
              <Photo photo={photo} slot={slots[e.id]} sizes="56px" />
            </span>
          ) : (
            <TypeMark type={e.type} />
          )}
          <span className="min-w-0 flex-1">
            <span className="serif block text-[23px] leading-tight md:text-[26px]">{e.title}</span>
            <span className="figures mt-1 block text-ui font-semibold sm:hidden">
              {e.startTime ? eventTimes(e) : "All day"}
            </span>
            <span className="mt-0.5 block text-meta text-moss sm:mt-1">
              {state === "now" && <span className="mr-2 font-semibold text-copper">Now</span>}
              {eventSummary(e)}
            </span>
            {lateNote[e.id] && (
              <span className="mt-0.5 block text-meta font-semibold text-copper">{lateNote[e.id]}</span>
            )}
          </span>
          <span className="figures hidden shrink-0 text-right text-ui font-semibold sm:block">
            {e.startTime ? eventTimes(e) : "All day"}
          </span>
          <span className="text-moss">
            <Toggle />
          </span>
        </summary>
        <div className="event-body grid gap-5 border-t border-rule p-4 md:grid-cols-[1fr_auto] md:p-5">
          <div>
            {atStart[e.id] && (
              <p className="figures mb-4 text-ui font-medium">
                <span className="text-label text-moss">Forecast at the start </span>
                <span className="block">{atStart[e.id]}</span>
              </p>
            )}
            <Details event={e} />
            <div className="mt-2">
              <Actions event={e} />
            </div>
          </div>
          {photo && (
            <div className="relative aspect-[4/3] w-full overflow-hidden md:w-56">
              <Photo photo={photo} slot={slots[e.id]} sizes="224px" />
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
