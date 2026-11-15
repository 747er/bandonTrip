"use client";

import Link from "next/link";
import { useState } from "react";
import { monthDay, weekday } from "@/lib/time";
import { eventTimes, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { Countdown } from "./Countdown";
import { Conditions } from "./features";

export type MobileStop = {
  event: PublicEvent;
  weather?: DayWeather;
};

const Arrow = ({ back = false }: { back?: boolean }) => (
  <svg width="9" height="15" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={back ? "rotate-180" : ""}>
    <path d="M1 1l6 6-6 6" />
  </svg>
);

const line = {
  width: 19,
  height: 19,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "shrink-0 text-mist",
};

/**
 * Phones only. A field of deep green that rises over the foot of the hero photograph
 * along a curve, as the panel does on wide screens. It says what is on, when, and what
 * the weather is doing; it opens on whatever is next, and its arrows step through every
 * event on the trip in order.
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
  const { event, weather } = stops[index];
  const isNext = live && index === initial;
  const button =
    "flex h-11 w-10 items-center justify-center text-limestone transition-colors enabled:active:bg-limestone/10 disabled:opacity-25";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Trip events, in order"
      className="on-forest relative z-10 -mt-px text-limestone md:hidden"
      style={{ background: "linear-gradient(to bottom, #1b3d31 0%, #17332b 40%, #10261f 100%)" }}
    >
      {/* The top edge: a curve cut into the photograph, with a fine copper line along it. */}
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-full block h-[4.5rem] w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path d="M0 101 L0 92 C 28 62 62 78 100 0 L100 101 Z" fill="#1b3d31" />
        <path d="M0 92 C 28 62 62 78 100 0" fill="none" stroke="#d99a6c" strokeWidth="1.25" opacity="0.65" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Contour lines, like a course map. */}
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-[0.1]" viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#e9e7e0" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((k) => (
          <path key={k} d={`M${170 + k * 44} -10 C ${250 + k * 36} ${34 + k * 14}, ${330 + k * 22} ${60 + k * 34}, 410 ${92 + k * 52}`} vectorEffect="non-scaling-stroke" />
        ))}
        {[0, 1, 2, 3].map((k) => (
          <path key={`b${k}`} d={`M-10 ${330 + k * 26} C ${70 + k * 12} ${318 + k * 20}, ${150 + k * 20} ${352 + k * 18}, ${220 + k * 34} 430`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="relative px-6 pb-6 pt-1">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-3 text-meta text-mist" aria-live="polite">
            <span>
              {isNext ? (
                underway ? (
                  <span className="font-semibold text-copper-light">Happening now</span>
                ) : (
                  <>
                    Next up{" "}
                    {start && <Countdown className="font-semibold text-limestone" target={start} initialNow={now} timeZone={timeZone} />}
                  </>
                )
              ) : (
                weekday(event.date)
              )}
            </span>
            <span aria-hidden="true" className="h-px w-9 bg-copper-light" />
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

        <div key={event.id} className="day-panel">
          <h2 className="display mt-1 text-[2.75rem]">{event.title}</h2>
          <ul className="figures mt-4 space-y-2.5 text-ui">
            <li className="flex items-center gap-3 font-medium">
              <svg {...line}>
                <rect x="2.5" y="3.5" width="13" height="12" rx="1" />
                <path d="M2.5 7.5h13M6 2v3M12 2v3" />
              </svg>
              {weekday(event.date)}, {monthDay(event.date)}
            </li>
            {event.startTime && (
              <li className="flex items-center gap-3 font-semibold">
                <svg {...line}>
                  <circle cx="9" cy="9" r="6.5" />
                  <path d="M9 5.5V9l2.5 1.5" />
                </svg>
                <span>
                  {event.type === "golf" && <span className="mr-2 font-medium text-mist">Tee times</span>}
                  {eventTimes(event)}
                  {event.partySize && <span className="ml-2 font-medium text-mist">party of {event.partySize}</span>}
                </span>
              </li>
            )}
          </ul>
          {weather && <Conditions weather={weather} className="mt-5 border-y border-rule-light py-4" />}
          <Link className="action mt-1" href={`/t/${slug}/schedule?day=${event.date}`}>
            Schedule
          </Link>
        </div>
      </div>
    </section>
  );
}
