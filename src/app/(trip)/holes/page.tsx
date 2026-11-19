import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoleFlyover, type FlyoverRound } from "@/components/public/holes/HoleFlyover";
import { holeTimes } from "@/lib/holeRound";
import { courseFor, HOLES } from "@/lib/holes";
import { clock, weekdayShort } from "@/lib/time";
import { getTripNow, roundNumbers } from "@/lib/trip";
import { getTrip } from "@/lib/viewer";
import { getWind } from "@/lib/wind";
import { hourIndex } from "@/lib/windMath";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Holes" };

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export default async function HolesPage({ searchParams }: PageProps<"/holes">) {
  const { course, hole } = await searchParams;
  const data = await getTrip();
  if (!data) notFound();
  // The layout shows only the name sheet until a player is chosen; send nothing else.
  if (!data.viewer) return null;
  const { trip, events } = data;
  const [wind, { now, phase }] = await Promise.all([getWind(trip), getTripNow(trip)]);

  /** A local date and "HH:MM" as fractional hours into the forecast, or -1 outside it. */
  const hourOf = (date: string, time: string) => {
    const i = wind ? hourIndex(wind.times, date, time) : -1;
    return i < 0 ? -1 : i + Number(time.slice(3, 5)) / 60;
  };

  const numbers = roundNumbers(events);
  // The viewer's rounds, in playing order, each on a course we have the holes for.
  const rounds: FlyoverRound[] = events.flatMap((e) => {
    const id = e.type === "golf" ? courseFor(e.title) : null;
    if (!id || !HOLES[id]) return [];
    const tee = e.teeTime ?? e.startTime;
    return [{
      course: id,
      name: HOLES[id].name,
      date: e.date,
      day: `${weekdayShort(e.date)} ${Number(e.date.slice(8))}`,
      tee: tee ? clock(tee) : null,
      teeHour: tee ? hourOf(e.date, tee) : -1,
      number: numbers[e.id]?.number ?? null,
      total: numbers[e.id]?.total ?? null,
    }];
  });

  if (rounds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-24 md:px-8 md:pt-36">
        <h1 className="display text-[clamp(2.75rem,11vw,4.5rem)]">Holes</h1>
        <p className="serif mt-6 max-w-prose text-[19px] italic leading-relaxed text-moss">
          There are no rounds on your schedule, so there are no holes to walk.
        </p>
      </div>
    );
  }

  // Where to open: the hole asked for in the link; else, mid-round, the hole the group is
  // probably on; else the first tee of the next round still to come; else the first round.
  const asked = rounds.findIndex((r) => r.course === course);
  const today = rounds.findIndex((r) => r.date === now.date);
  const pace = (i: number) => holeTimes(HOLES[rounds[i].course].holes);
  let round = 0;
  let n = HOLES[rounds[0].course].holes[0].n;
  if (asked >= 0) {
    round = asked;
    const holes = HOLES[rounds[asked].course].holes;
    n = holes.find((h) => String(h.n) === hole)?.n ?? holes[0].n;
  } else if (phase === "during" && today >= 0 && rounds[today].tee) {
    round = today;
    const tee = events.find((e) => e.date === now.date && e.type === "golf");
    const start = tee?.teeTime ?? tee?.startTime;
    const played = start ? minutesOf(now.time) - minutesOf(start) : -1;
    const times = pace(today);
    n = (played >= 0 ? times.find((t) => played < t.until) : undefined)?.n ?? times[0].n;
    // A round that is over moves on to the next one.
    if (played >= times.at(-1)!.until && today + 1 < rounds.length) {
      round = today + 1;
      n = HOLES[rounds[round].course].holes[0].n;
    }
  } else {
    const next = rounds.findIndex((r) => r.date >= now.date);
    if (next >= 0) {
      round = next;
      n = HOLES[rounds[next].course].holes[0].n;
    }
  }

  return (
    <>
      <h1 className="sr-only">Holes</h1>
      <HoleFlyover wind={wind} rounds={rounds} initial={{ round, hole: n, asked: asked >= 0 }} center={[trip.longitude, trip.latitude]} timezone={trip.timezone} />
    </>
  );
}
