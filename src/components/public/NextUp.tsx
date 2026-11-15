"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { monthDay, weekday } from "@/lib/time";
import { eventTimes, teeLabel, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { Countdown } from "./Countdown";
import { eventSummary } from "./EventList";
import { Conditions, type RoundInfo } from "./features";

export type NextUpSlide = {
  event: PublicEvent;
  round: RoundInfo | null;
  weather?: DayWeather;
  /** ISO instant it starts, when it has a start time */
  start: string | null;
  /** Where it stands against the clock when the page was rendered */
  state: "past" | "now" | "upcoming";
};

const line = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "shrink-0 text-mist",
};
const icon = {
  day: (
    <svg {...line}>
      <rect x="2.5" y="3.5" width="13" height="12" rx="1" />
      <path d="M2.5 7.5h13M6 2v3M12 2v3" />
    </svg>
  ),
  time: (
    <svg {...line}>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5V9l2.5 1.5" />
    </svg>
  ),
  round: (
    <svg {...line}>
      <path d="M5 16V2.5l8.5 3L5 9" />
    </svg>
  ),
};

const Arrow = ({ back = false }: { back?: boolean }) => (
  <svg width="10" height="16" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={back ? "rotate-180" : ""}>
    <path d="M1 1l6 6-6 6" />
  </svg>
);

/**
 * The opening card: every event on the trip, one at a time, opening on whatever is next
 * (or under way). Arrows or a swipe step through the rest, in order.
 */
export function NextUp({
  slides,
  initial,
  slug,
  now,
  timeZone,
}: {
  slides: NextUpSlide[];
  /** Index of the slide to open on */
  initial: number;
  slug: string;
  /** ISO instant the page was rendered at */
  now: string;
  timeZone: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);

  // Open on the next event without animating there.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollTo({ left: initial * el.clientWidth, behavior: "instant" });
  }, [initial]);

  const go = (to: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, to)) * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const button =
    "flex h-11 w-11 items-center justify-center text-limestone transition-colors enabled:hover:bg-limestone/10 disabled:opacity-30";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Trip events, in order"
      className="on-forest @container bg-forest text-limestone md:bg-transparent"
    >
      <div className="flex items-center justify-between border-b border-rule-light pl-5 @md:pl-7">
        <p className="figures text-label text-mist" aria-live="polite">
          <span className="font-semibold text-limestone">{index + 1}</span> of {slides.length}
        </p>
        <div className="flex">
          <button type="button" className={button} aria-label="Previous event" disabled={index === 0} onClick={() => go(index - 1)}>
            <Arrow back />
          </button>
          <button type="button" className={button} aria-label="Next event" disabled={index === slides.length - 1} onClick={() => go(index + 1)}>
            <Arrow />
          </button>
        </div>
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map(({ event, round, weather, start, state }, i) => {
          const golf = event.type === "golf";
          return (
            <article
              key={event.id}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${event.title}`}
              // Off-screen slides stay out of the tab order.
              inert={i !== index}
              className="flex w-full shrink-0 snap-center flex-col"
            >
              <div className="flex-1 p-5 @md:p-7">
                <p className="flex items-center gap-3 text-meta text-mist">
                  <span>
                    {state === "now" ? (
                      <span className="font-semibold text-copper-light">Happening now</span>
                    ) : state === "past" ? (
                      "Finished"
                    ) : (
                      <>
                        {i === initial ? "Next up" : "Starts"}{" "}
                        {start && <Countdown className="font-semibold text-limestone" target={start} initialNow={now} timeZone={timeZone} />}
                      </>
                    )}
                  </span>
                  <span aria-hidden="true" className="h-px w-9 bg-copper-light" />
                </p>
                <h2 className="display mt-2 text-[clamp(2.5rem,10vw,3rem)] @md:text-[3.5rem]">{event.title}</h2>
                <ul className="figures mt-4 space-y-2 text-ui">
                  <li className="flex items-center gap-3 font-medium">
                    {icon.day}
                    {weekday(event.date)}, {monthDay(event.date)}
                  </li>
                  {event.startTime && (
                    <li className="flex items-start gap-3 font-semibold">
                      <span className="mt-0.5">{icon.time}</span>
                      <span>
                        {golf && <span className="mr-2 font-medium text-mist">{teeLabel(event)}</span>}
                        {eventTimes(event)}
                      </span>
                    </li>
                  )}
                  <li className="flex items-center gap-3 text-meta text-mist">
                    {icon.round}
                    {round ? `Round ${round.number} of ${round.total}` : eventSummary(event)}
                  </li>
                </ul>
                {weather && <Conditions weather={weather} grid="phone" className="mt-4 border-t border-rule-light pt-4" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-8 border-t border-rule-light px-5 @md:px-7">
                <Link className="action" href={`/t/${slug}/schedule?day=${event.date}`}>
                  {weekday(event.date)}&rsquo;s schedule
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
