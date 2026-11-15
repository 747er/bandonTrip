"use client";

import Link from "next/link";
import { useState } from "react";
import { monthDayShort, weekday, weekdayShort } from "@/lib/time";
import { eventTimes, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { Countdown } from "./Countdown";
import { WeatherGlyph, WindGlyph } from "./Glyphs";

export type MobileStop = {
  event: PublicEvent;
  weather?: DayWeather;
};

const Arrow = ({ back = false }: { back?: boolean }) => (
  <svg width="9" height="15" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={back ? "rotate-180" : ""}>
    <path d="M1 1l6 6-6 6" />
  </svg>
);

/**
 * Phones only. A dark panel that rides up over the foot of the hero photograph, saying
 * what is on, when, and what the weather is doing. It opens on whatever is next, and
 * its arrows step through every event on the trip in order.
 */
export function MobileDay({
  stops,
  initial,
  live,
  underway,
  slug,
  now,
  timeZone,
  start,
}: {
  stops: MobileStop[];
  /** Index of the event to open on: the next one, or the one under way */
  initial: number;
  /** False once every event has finished: then nothing is "next" */
  live: boolean;
  /** Whether the event it opens on has already begun */
  underway: boolean;
  slug: string;
  now: string;
  timeZone: string;
  /** ISO instant the opening event starts, for the countdown */
  start: string | null;
}) {
  const [index, setIndex] = useState(initial);
  const { event, weather: w } = stops[index];
  const isNext = live && index === initial;
  const button =
    "flex h-11 w-10 items-center justify-center text-limestone transition-colors enabled:active:bg-limestone/10 disabled:opacity-25";

  return (
    <div className="relative z-10 bg-forest-deep pb-6 text-limestone md:hidden">
      {/* Pulled up over the photograph, so picture and plan read as one. */}
      <section
        aria-roledescription="carousel"
        aria-label="Trip events, in order"
        className="relative mx-4 -mt-16 overflow-hidden bg-forest px-5 pb-5 pt-2 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)]"
      >
        <svg aria-hidden="true" className="absolute -right-10 -top-12 h-52 w-52 opacity-[0.09]" viewBox="0 0 200 200" fill="none" stroke="#e9e7e0" strokeWidth="1">
          {[22, 38, 54, 70, 86, 98].map((r, k) => (
            <ellipse key={r} cx="120" cy="80" rx={r} ry={r * 0.84} transform={`rotate(${k * 9} 120 80)`} />
          ))}
        </svg>

        <div className="relative flex items-center justify-between">
          <p className="flex items-baseline gap-2.5" aria-live="polite">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-copper-light">
              {isNext ? (underway ? "Happening now" : event.type === "golf" ? "Next round" : "Next up") : weekday(event.date)}
            </span>
            {isNext && !underway && start && (
              <Countdown className="text-label text-mist" target={start} initialNow={now} timeZone={timeZone} />
            )}
          </p>
          <div className="-mr-3 flex">
            <button type="button" className={button} aria-label="Previous event" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <Arrow back />
            </button>
            <button type="button" className={button} aria-label="Next event" disabled={index === stops.length - 1} onClick={() => setIndex(index + 1)}>
              <Arrow />
            </button>
          </div>
        </div>

        <div key={event.id} className="day-panel relative">
          <h2 className="display text-[2.375rem]">{event.title}</h2>
          <p className="figures mt-2.5 flex flex-wrap gap-x-3 text-ui">
            <span className="text-mist">
              {weekdayShort(event.date)}, {monthDayShort(event.date)}
            </span>
            {event.startTime && <span className="font-semibold">{eventTimes(event)}</span>}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4">
            {w ? (
              <p className="figures flex items-center gap-3.5 text-meta">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <WeatherGlyph kind={w.kind} size={20} className="text-mist" />
                  {w.high}°
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <WindGlyph size={17} className="text-mist" />
                  <span className="font-semibold">{w.gust !== null ? `${w.wind}–${w.gust}` : w.wind}</span>
                  <span className="text-mist">mph</span>
                </span>
              </p>
            ) : (
              <span />
            )}
            <Link
              href={`/t/${slug}/schedule?day=${event.date}`}
              className="-mb-1.5 -mr-1 inline-flex min-h-11 shrink-0 items-center gap-2 bg-limestone px-4 text-meta font-semibold text-pine active:bg-paper"
            >
              Schedule
              <svg width="7" height="12" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 1l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
