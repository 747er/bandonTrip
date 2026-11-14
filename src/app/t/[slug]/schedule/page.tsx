import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetails } from "@/components/public/EventList";
import { dayCount, eachDay, monthDay, weekday } from "@/lib/time";
import { getTrip, getTripNow, isPast, isUnderway } from "@/lib/trip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ params }: PageProps<"/t/[slug]/schedule">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip, events, people } = data;
  const { now, phase } = await getTripNow(trip);

  // Every trip day gets a chapter, plus any days outside the trip that have events.
  const days = [
    ...new Set([...eachDay(trip.startDate, trip.endDate), ...events.map((e) => e.date)]),
  ].sort();
  const tripDays = eachDay(trip.startDate, trip.endDate);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-24 md:px-8 md:pt-36">
      <h1 className="display text-[clamp(3.25rem,16vw,6rem)]">Schedule</h1>
      <p className="mt-4 text-[14.5px] text-moss">
        All times Pacific. Tap an event for details.{" "}
        <a
          className="underline decoration-copper underline-offset-4"
          href={`/t/${trip.slug}/calendar.ics`}
        >
          Add everything to your calendar
        </a>
      </p>

      {days.map((date) => {
        const dayEvents = events.filter((e) => e.date === date);
        const index = tripDays.indexOf(date);
        const isToday = phase === "during" && date === now.date;
        return (
          <section key={date} aria-labelledby={`day-${date}`} className="mt-14">
            <header className="flex items-end justify-between border-b border-pine pb-3">
              <h2 id={`day-${date}`} className="display text-[40px] md:text-[48px]">
                {weekday(date)}
              </h2>
              <p className="pb-1 text-right text-[13.5px] leading-snug text-moss">
                {isToday && <span className="block font-semibold text-copper">Today</span>}
                {monthDay(date)}
                {index >= 0 && <span className="block">Day {dayCount(index + 1)}</span>}
              </p>
            </header>
            {dayEvents.length === 0 ? (
              <p className="serif py-6 text-[16px] italic text-moss">Nothing scheduled yet.</p>
            ) : (
              <div className="divide-y divide-rule border-b border-rule">
                {dayEvents.map((e) => (
                  <EventDetails
                    key={e.id}
                    event={e}
                    people={people}
                    slug={trip.slug}
                    state={
                      phase === "before"
                        ? null
                        : isUnderway(e, now)
                          ? "now"
                          : isPast(e, now) && phase === "during"
                            ? "past"
                            : null
                    }
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
