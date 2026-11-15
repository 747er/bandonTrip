"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, unit: string) => `${word(n)} ${unit}${n === 1 ? "" : "s"}`;

/** The calendar date ("2026-11-19") an instant falls on in a timezone. */
const dateIn = (ms: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms);

/**
 * How long until `target`, said the way people count it: by the calendar once it is a day
 * or more away ("in five days", "tomorrow"), and by the clock on the day itself
 * ("in nine hours", "in 20 minutes"). Saturday night to Thursday morning is five days.
 */
export function waitPhrase(now: number, target: number, timeZone: string): string {
  const days = Math.round(
    (Date.parse(`${dateIn(target, timeZone)}T00:00:00Z`) - Date.parse(`${dateIn(now, timeZone)}T00:00:00Z`)) / 86_400_000,
  );
  if (days >= 2) return `in ${plural(days, "day")}`;
  if (days === 1) return "tomorrow";
  const minutes = Math.max(1, Math.floor((target - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours >= 1 ? `in ${plural(hours, "hour")}` : `in ${plural(minutes, "minute")}`;
}

/** Live text for the time left until `target`. Renders nothing once it has passed. */
export function Countdown({
  target,
  initialNow,
  timeZone,
  className,
}: {
  /** ISO instant being counted down to */
  target: string;
  /** ISO instant the server rendered at, so the first paint matches */
  initialNow: string;
  /** The trip's timezone, for counting calendar days */
  timeZone: string;
  className?: string;
}) {
  const end = new Date(target).getTime();
  const [now, setNow] = useState(() => new Date(initialNow).getTime());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (end <= now) return null;
  return <span className={className}>{waitPhrase(now, end, timeZone)}</span>;
}
