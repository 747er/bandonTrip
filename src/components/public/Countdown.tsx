"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, unit: string) => `${word(n)} ${unit}${n === 1 ? "" : "s"}`;

/** The wait in words: "Five days", "Nine hours", "20 minutes". */
export function waitLabel(msLeft: number): string {
  const minutes = Math.max(0, Math.floor(msLeft / 60_000));
  const days = Math.floor(minutes / 1440);
  if (days >= 2) return plural(days, "day");
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) return plural(hours, "hour");
  return plural(Math.max(1, minutes), "minute");
}

/** Live text for the time left until `target`. Renders nothing once it has passed. */
export function Countdown({
  target,
  initialNow,
  className,
}: {
  /** ISO instant being counted down to */
  target: string;
  /** ISO instant the server rendered at, so the first paint matches */
  initialNow: string;
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
  return <span className={className}>{waitLabel(end - now)}</span>;
}
