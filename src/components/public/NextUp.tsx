"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { directionsUrl } from "@/lib/links";
import { monthDay, weekday } from "@/lib/time";
import { eventTimes, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { Countdown } from "./Countdown";
import { eventSummary } from "./EventList";
import { Conditions, type RoundInfo } from "./features";
import { Photo, type PhotoData } from "./Photo";

export type NextUpSlide = {
  event: PublicEvent;
  round: RoundInfo | null;
  weather?: DayWeather;
  photo: PhotoData;
  slot: string;
  /** ISO instant it starts, when it has a start time */
  start: string | null;
  /** Where it stands against the clock when the page was rendered */
  state: "past" | "now" | "upcoming";
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
      className="on-forest bg-forest text-limestone lg:bg-forest/92 lg:shadow-[0_24px_60px_-20px_rgb(13_33_27/0.7)] lg:backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-rule-light pl-5 md:pl-7">
        <p className="figures text-label text-mist" aria-live="polite">
          <span className="font-semibold text-limestone">{index + 1}</span> of {slides.length}
          {index !== initial && (
            <button type="button" onClick={() => go(initial)} className="ml-3 min-h-11 font-semibold text-limestone underline decoration-copper-light decoration-1 underline-offset-4">
              Back to what&rsquo;s next
            </button>
          )}
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
        {slides.map(({ event, round, weather, photo, slot, start, state }, i) => {
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
              {photo && (
                <div className="relative hidden h-36 shrink-0 overflow-hidden lg:block">
                  <Photo photo={photo} slot={slot} sizes="400px" />
                </div>
              )}
              <div className="flex-1 p-5 md:p-7">
                <p className="text-meta text-mist">
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
                </p>
                <h2 className="display mt-1.5 text-[clamp(2.5rem,10vw,3rem)]">{event.title}</h2>
                <p className="figures mt-3 text-ui font-medium">
                  {weekday(event.date)}, {monthDay(event.date)}
                </p>
                {event.startTime && (
                  <p className="figures mt-1 text-fact font-semibold">
                    {golf && <span className="mr-2 text-ui font-medium text-mist">Tee times</span>}
                    {eventTimes(event)}
                  </p>
                )}
                <p className="figures mt-1 text-meta text-mist">
                  {round ? `Round ${round.number} of ${round.total}, par ${round.par}` : eventSummary(event)}
                </p>
                {weather && <Conditions weather={weather} grid="phone" className="mt-4 border-t border-rule-light pt-4" />}
              </div>
              <div className="flex items-center gap-x-8 border-t border-rule-light px-5 md:px-7">
                <Link className="action" href={`/t/${slug}/schedule?day=${event.date}`}>
                  {weekday(event.date)}&rsquo;s schedule
                </Link>
                <a className="action" href={directionsUrl(event)} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
