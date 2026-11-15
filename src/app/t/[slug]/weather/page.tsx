import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WindExplorer, type WindEvent, type WindPlace } from "@/components/public/wind/WindExplorer";
import { GEO, PLACES, placeFor } from "@/lib/resortMap";
import { clock, weekdayShort } from "@/lib/time";
import { eventTimes, getTripNow } from "@/lib/trip";
import { getTrip } from "@/lib/viewer";
import { getWind } from "@/lib/wind";
import { hourIndex, minutesFromStart } from "@/lib/windMath";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wind and weather" };

export default async function WeatherPage({ params, searchParams }: PageProps<"/t/[slug]/weather">) {
  const { slug } = await params;
  const { day } = await searchParams;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip, events, viewer } = data;
  const [wind, { now, phase }] = await Promise.all([getWind(trip), getTripNow(trip)]);

  if (!wind) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-24 md:px-8 md:pt-36">
        <h1 className="display text-[clamp(2.75rem,11vw,4.5rem)]">Wind and weather</h1>
        <p className="serif mt-6 max-w-prose text-[19px] italic leading-relaxed text-moss">
          The hour-by-hour forecast isn&rsquo;t available right now. It covers about two weeks ahead,
          so check back closer to the trip.
        </p>
      </div>
    );
  }

  const hourOf = (date: string, time: string) => {
    const i = hourIndex(wind.times, date, time);
    return i < 0 ? -1 : i + Number(time.slice(3, 5)) / 60;
  };

  const windEvents: WindEvent[] = events.flatMap((e) => {
    if (!e.startTime) return [];
    const start = hourOf(e.date, e.startTime);
    if (start < 0) return [];
    const end = e.endTime ? hourOf(e.date, e.endTime) : start;
    const placeId = placeFor(e.title, e.venue);
    // Time outdoors that is still going when the sun sets gets the sunset time beside it.
    const day = wind.days.find((d) => d.date === e.date);
    const sunset = day ? minutesFromStart(wind.times, day.sunset) : -1;
    const late = e.type !== "dining" && e.endTime && sunset >= 0 ? Math.round(end * 60 - sunset) : 0;
    return [
      {
        id: e.id,
        title: e.title,
        type: e.type,
        start,
        end: Math.max(start, end),
        label: `${weekdayShort(e.date)} ${eventTimes(e)}`,
        place: placeId && GEO[placeId] ? GEO[placeId] : null,
        placeId: placeId && GEO[placeId] ? placeId : null,
        sunsetNote: late > 0 && day ? `Sunset ${clock(day.sunset.slice(11))}` : null,
      },
    ];
  });

  const homeId = viewer?.roomPlace ?? null;
  const placeIds = [...new Set([...events.map((e) => placeFor(e.title, e.venue)), homeId])].filter(
    (id): id is string => !!id && !!GEO[id],
  );
  const places: WindPlace[] = placeIds.map((id) => ({
    id,
    name: PLACES[id].name.replace(/ clubhouse$/, ""),
    lat: GEO[id][0],
    lon: GEO[id][1],
    home: id === homeId,
    kind:
      id === homeId
        ? "home"
        : (["golf", "dining"] as const).find((type) =>
            events.some((e) => e.type === type && placeFor(e.title, e.venue) === id),
          ) ?? "other",
    // Two places a short walk apart: the western one carries its label on the left.
    side: id === homeId || placeIds.some(
      (other) =>
        other !== id &&
        Math.abs(GEO[other][0] - GEO[id][0]) < 0.0012 &&
        Math.abs(GEO[other][1] - GEO[id][1]) < 0.003 &&
        GEO[other][1] > GEO[id][1],
    )
      ? "left"
      : "right",
  }));

  // Open on the present hour during the trip, otherwise on the first thing scheduled.
  const current = phase === "during" ? hourOf(now.date, now.time) : -1;
  // A link from a day's forecast opens on that day: at its first event, or mid-morning.
  const asked = typeof day === "string" ? wind.days.findIndex((d) => d.date === day) : -1;
  const firstThatDay = windEvents.find((e) => Math.floor(e.start / 24) === asked);
  const initialHour =
    asked >= 0
      ? (firstThatDay?.start ?? asked * 24 + 10)
      : current >= 0
        ? current
        : (windEvents[0]?.start ?? 10);

  return (
    <>
      <h1 className="sr-only">Wind and weather</h1>
      {/* Keyed by who is looking: the map is built once, so a new person gets a new map. */}
      <WindExplorer
        key={viewer?.id ?? "nobody"}
        data={wind}
        events={windEvents}
        places={places}
        center={[trip.longitude, trip.latitude]}
        initialHour={initialHour}
      />
    </>
  );
}
