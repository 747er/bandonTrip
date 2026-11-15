import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackingList } from "@/components/public/PackingList";
import { CLUB_NOTES, LEAVE_IN_ROOM, PACKING, SOURCES } from "@/lib/packing";
import { dateRange, eachDay } from "@/lib/time";
import { getTrip } from "@/lib/viewer";
import { getForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packing list" };

export default async function PackingPage({ params }: PageProps<"/t/[slug]/packing">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip } = data;
  const weather = await getForecast(trip);
  const days = eachDay(trip.startDate, trip.endDate)
    .map((d) => weather[d])
    .filter(Boolean);

  // What the forecast says about the trip's own dates, when there is one. Nothing estimated.
  const outlook =
    days.length > 0
      ? [
          ["Highs", range(days.map((d) => d.high), "°")],
          ["Lows", range(days.map((d) => d.low), "°")],
          ["Wind", `up to ${Math.max(...days.map((d) => d.gust ?? d.wind))} mph`],
          ...(days.some((d) => d.rainChance !== null)
            ? [["Rain", `up to ${Math.max(...days.map((d) => d.rainChance ?? 0))}%`]]
            : []),
        ]
      : null;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 md:px-10 md:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h1 className="display text-[clamp(2.75rem,11vw,4.5rem)]">Packing list</h1>
        <p className="pb-1.5 text-meta text-moss">
          {dateRange(trip.startDate, trip.endDate)}
          {trip.location && `, ${trip.location}`}
        </p>
      </div>
      <p className="serif mt-4 max-w-2xl text-[19px] italic leading-relaxed md:text-[21px]">
        No such thing as bad weather, only bad gear. This is the resort&rsquo;s own advice, turned into a
        checklist. Your ticks stay on this device.
      </p>

      <div className="mt-8 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <PackingList sections={PACKING} storageKey={`bt-packed-${trip.slug}`} />
        </div>

        <aside className="space-y-8 lg:sticky lg:top-8 lg:self-start">
          {outlook && (
            <section aria-labelledby="outlook" className="bg-forest-deep p-6 text-limestone">
              <h2 id="outlook" className="display text-[28px]">
                Forecast for our days
              </h2>
              <dl className="mt-4 divide-y divide-rule-light border-y border-rule-light">
                {outlook.map(([name, value]) => (
                  <div key={name} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-label text-mist">{name}</dt>
                    <dd className="figures text-ui font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="on-forest">
                <Link className="action" href={`/t/${trip.slug}/schedule`}>
                  Day by day on the schedule
                </Link>
              </div>
              <p className="text-fine text-mist">
                Forecast by{" "}
                <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                  Open-Meteo
                </a>
              </p>
            </section>
          )}

          <section aria-labelledby="leave">
            <h2 id="leave" className="display text-[28px]">
              Leave in your room
            </h2>
            <p className="mt-2 text-meta text-moss">
              The resort asks that these come out of the golf bag before a round.
            </p>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {LEAVE_IN_ROOM.map((item) => (
                <li key={item} className="py-2.5 text-ui font-medium">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="clubs">
            <h2 id="clubs" className="display text-[28px]">
              Before you choose clubs
            </h2>
            <ul className="mt-3 space-y-3 text-meta">
              {CLUB_NOTES.map((note) => (
                <li key={note} className="border-l-2 border-copper pl-4">
                  {note}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="sources" className="border-t border-pine pt-5">
            <h2 id="sources" className="text-label font-semibold">
              Where this comes from
            </h2>
            <p className="mt-1 text-meta text-moss">
              Bandon Dunes Golf Resort&rsquo;s published guides, reworded. Forgot something? The
              resort&rsquo;s shops stock it.
            </p>
            <ul className="mt-1">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  <a className="action" href={s.href} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function range(values: number[], unit: string): string {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? `${low}${unit}` : `${low}${unit} to ${high}${unit}`;
}
