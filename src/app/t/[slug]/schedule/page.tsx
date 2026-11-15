import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RoundInfo } from "@/components/public/features";
import { ScheduleView } from "@/components/public/ScheduleView";
import { courseById } from "@/data/courses";
import { photosForEvents, slotFor, slotName } from "@/lib/photos";
import { placeFor } from "@/lib/resortMap";
import { clock, dateRange, eachDay, zonedToUtc } from "@/lib/time";
import { getTrip, getTripNow, isPast, isUnderway, roundNumbers } from "@/lib/trip";
import { getForecast } from "@/lib/weather";
import { getWind } from "@/lib/wind";
import { compass, hourIndex, minutesFromStart } from "@/lib/windMath";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
  params,
  searchParams,
}: PageProps<"/t/[slug]/schedule">) {
  const { slug } = await params;
  const { day } = await searchParams;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip, events, lodging } = data;
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
  const homePlace = placeFor(lodging);

  // Hour-by-hour: what it is forecast to be doing when each event starts, the day's
  // daylight, and a note on anything outdoors that runs past sunset.
  const atStart: Record<string, string> = {};
  const lateNote: Record<string, string> = {};
  const daylight: Record<string, { sunrise: string; sunset: string }> = {};
  if (wind) {
    for (const d of wind.days) daylight[d.date] = { sunrise: clock(d.sunrise.slice(11)), sunset: clock(d.sunset.slice(11)) };
    for (const e of events) {
      if (!e.startTime) continue;
      const h = hourIndex(wind.times, e.date, e.startTime);
      if (h < 0) continue;
      const { temp, speed, gust, direction } = wind.point;
      atStart[e.id] = `${temp[h]}°, wind ${speed[h]} mph from the ${compass(direction[h])}${
        gust[h] > speed[h] ? `, gusts ${gust[h]}` : ""
      }`;
      const day = wind.days.find((d) => d.date === e.date);
      if (day && e.endTime && e.type !== "dining") {
        const late =
          minutesFromStart(wind.times, `${e.date}T${e.endTime}`) - minutesFromStart(wind.times, day.sunset);
        if (late > 0) lateNote[e.id] = `The sun sets at ${clock(day.sunset.slice(11))}`;
      }
    }
  }

  const next =
    phase === "after"
      ? null
      : events.find((e) => e.startTime && !isPast(e, now) && !isUnderway(e, now));

  return (
    <ScheduleView
      trip={{
        slug: trip.slug,
        title: trip.title,
        location: trip.location,
        dates: dateRange(trip.startDate, trip.endDate),
      }}
      days={days}
      tripDays={tripDays}
      events={events}
      photos={photosForEvents(events)}
      slots={Object.fromEntries(events.map((e) => [e.id, slotFor(e)]))}
      weather={weather}
      rounds={roundInfo}
      states={states}
      courses={Object.fromEntries(
        events
          .filter((e) => e.type === "golf" && courseById(slotName(e.title)))
          .map((e) => [e.id, `/t/${trip.slug}/courses/${slotName(e.title)}`]),
      )}
      atStart={atStart}
      lateNote={lateNote}
      daylight={daylight}
      places={places}
      homePlace={homePlace}
      initialDay={requested ?? today ?? days[0]}
      today={today}
      upNext={
        next?.startTime
          ? {
              title: next.title,
              date: next.date,
              target: zonedToUtc(next.date, next.startTime, trip.timezone).toISOString(),
              now: now.instant.toISOString(),
              timeZone: trip.timezone,
            }
          : null
      }
    />
  );
}
