import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RoundInfo } from "@/components/public/features";
import { ScheduleView } from "@/components/public/ScheduleView";
import { courseById } from "@/data/courses";
import { PEOPLE, STAY, TEE_SHEET } from "@/data/trip";
import { photosForEvents, slotFor, slotName } from "@/lib/photos";
import { PLACES, placeFor } from "@/lib/resortMap";
import { addDays, clock, eachDay, zonedToUtc } from "@/lib/time";
import { getTripNow, isPast, isUnderway, personId, roundNumbers } from "@/lib/trip";
import { getTrip } from "@/lib/viewer";
import { getForecast } from "@/lib/weather";
import { getWind } from "@/lib/wind";
import { forecastAt, minutesFromStart, type ForecastAt } from "@/lib/windMath";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
  searchParams,
}: PageProps<"/schedule">) {
  const { day } = await searchParams;
  const data = await getTrip();
  if (!data) notFound();
  // The layout shows only the name sheet until a player is chosen; send nothing else.
  if (!data.viewer) return null;
  const { trip, events, viewer } = data;
  const [{ now, phase }, weather, wind] = await Promise.all([
    getTripNow(trip),
    getForecast(trip),
    getWind(trip),
  ]);

  // Every trip day gets a tab, plus any day outside the trip that has an event.
  const tripDays = eachDay(trip.startDate, trip.endDate);
  const days = [...new Set([...tripDays, ...events.map((e) => e.date)])].sort();
  const requested = typeof day === "string" && days.includes(day) ? day : null;
  const today = phase === "during" ? now.date : null;

  const roundInfo: Record<string, RoundInfo> = roundNumbers(events);

  const states: Record<string, "past" | "now"> = {};
  for (const e of events) {
    if (phase === "during") {
      if (isUnderway(e, now)) states[e.id] = "now";
      else if (isPast(e, now)) states[e.id] = "past";
    }
  }

  // Where each event sits on the resort map, and where the group is staying.
  const places: Record<string, string> = {};
  for (const e of events) {
    const id = placeFor(e.title, e.venue);
    if (id) places[e.id] = id;
  }
  const homePlace = viewer?.roomPlace ?? null;

  // Hour-by-hour: what it is forecast to be doing when each event starts, the day's
  // daylight, and a note on anything outdoors that runs past sunset.
  const atStart: Record<string, ForecastAt> = {};
  const lateNote: Record<string, string> = {};
  const daylight: Record<string, { sunrise: string; sunset: string; rise: string; set: string }> = {};
  if (wind) {
    for (const d of wind.days) daylight[d.date] = { sunrise: clock(d.sunrise.slice(11)), sunset: clock(d.sunset.slice(11)), rise: d.sunrise.slice(11, 16), set: d.sunset.slice(11, 16) };
    for (const e of events) {
      if (!e.startTime) continue;
      const minute = minutesFromStart(wind.times, `${e.date}T${e.startTime}`);
      if (minute < 0) continue;
      atStart[e.id] = forecastAt(wind.point, minute / 60);
      const day = wind.days.find((d) => d.date === e.date);
      if (day && e.endTime && e.type !== "dining") {
        const late =
          minutesFromStart(wind.times, `${e.date}T${e.endTime}`) - minutesFromStart(wind.times, day.sunset);
        if (late > 0) lateNote[e.id] = `The sun sets at ${clock(day.sunset.slice(11))}`;
      }
    }
  }

  // A countdown on your round, only when it is today or tomorrow.
  const soon = phase === "after" ? [] : [now.date, addDays(now.date, 1)];
  const teeStarts: Record<string, string> = {};
  for (const e of events) {
    if (e.type === "golf" && e.teeTime && soon.includes(e.date)) {
      teeStarts[e.id] = zonedToUtc(e.date, e.teeTime, trip.timezone).toISOString();
    }
  }

  return (
    <ScheduleView
      days={days}
      events={events}
      photos={photosForEvents(events)}
      slots={Object.fromEntries(events.map((e) => [e.id, slotFor(e)]))}
      weather={weather}
      rounds={roundInfo}
      states={states}
      courses={Object.fromEntries(
        events
          .filter((e) => e.type === "golf" && courseById(slotName(e.title)))
          .map((e) => [e.id, `/courses/${slotName(e.title)}`]),
      )}
      atStart={atStart}
      lateNote={lateNote}
      daylight={daylight}
      places={places}
      homePlace={homePlace}
      homeLabel={viewer?.room ?? null}
      where={Object.fromEntries(
        events.map((e) => {
          const spot = places[e.id] ? PLACES[places[e.id]].name : "";
          // "Trails End Restaurant, Bandon Trails clubhouse"; a clubhouse alone for a round.
          const venue = e.venue && e.venue !== e.title ? e.venue : "";
          return [e.id, [venue, spot].filter(Boolean).join(", ") || e.title];
        }),
      )}
      party={Object.fromEntries(
        events
          .filter((e) => e.type !== "golf")
          .map((e) => [e.id, PEOPLE.filter((p) => (p.core || p.outings) && personId(p.key) !== viewer?.id).map((p) => p.name)]),
      )}
      firstTee={Object.fromEntries(
        events.flatMap((e) => {
          const first = e.type === "golf" ? TEE_SHEET[e.title]?.[0]?.[0] : undefined;
          return first ? [[e.id, clock(first)]] : [];
        }),
      )}
      courseFacts={Object.fromEntries(
        events.flatMap((e) => {
          const course = e.type === "golf" ? courseById(slotName(e.title)) : null;
          return course ? [[e.id, `Par ${course.par} · ${course.yards.toLocaleString("en-US")} yards`]] : [];
        }),
      )}
      teeStarts={teeStarts}
      now={now.instant.toISOString()}
      timeZone={trip.timezone}
      shuttle={STAY.shuttle}
      viewerName={viewer?.name ?? null}
      initialDay={requested ?? today ?? days[0]}
      today={today}
    />
  );
}
