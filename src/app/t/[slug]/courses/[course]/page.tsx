import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo, PhotoCredit } from "@/components/public/Photo";
import { COURSES, courseById } from "@/data/courses";
import { photoFor, slotFor, slotName } from "@/lib/photos";
import { clock, monthDay, weekday } from "@/lib/time";
import { directionsUrl, getTrip, roundNumbers } from "@/lib/trip";
import { getWind } from "@/lib/wind";
import { compass, hourIndex } from "@/lib/windMath";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/courses/[course]">): Promise<Metadata> {
  const { course } = await params;
  return { title: courseById(course)?.name ?? "Course" };
}

export default async function CoursePage({ params }: PageProps<"/t/[slug]/courses/[course]">) {
  const { slug, course: id } = await params;
  const data = await getTrip(slug);
  const course = courseById(id);
  if (!data || !course) notFound();
  const { trip, events } = data;

  // Our round here, if this course is on the trip.
  const round = events.find((e) => e.type === "golf" && slotName(e.title) === course.id) ?? null;
  const number = round ? roundNumbers(events)[round.id] : null;
  const photo = photoFor(round ? slotFor(round) : `courses/${course.id}`);
  const wind = round?.startTime ? await getWind(trip) : null;
  const hour = wind && round?.startTime ? hourIndex(wind.times, round.date, round.startTime) : -1;

  const facts: [string, string][] = [
    ["Designer", course.designer],
    ["Opened", String(course.opened)],
    ["Par", String(course.par)],
    ["Length", `${course.yards.toLocaleString("en-US")} yards`],
    ["Par 3s", String(course.par3s)],
    ["Par 5s", String(course.par5s)],
  ];
  // The trip's courses in playing order, then any others.
  const played = events.filter((e) => e.type === "golf").map((e) => courseById(slotName(e.title)));
  const others = [...new Set([...played, ...COURSES])].filter((c) => c !== null);

  return (
    <article>
      <header className="relative isolate h-[46svh] min-h-[320px] overflow-hidden bg-forest-deep text-paper md:h-[62svh]">
        <Photo photo={photo} slot={`courses/${course.id}`} priority sizes="100vw" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(13 33 27 / 0.92) 0%, rgb(13 33 27 / 0.62) 30%, rgb(13 33 27 / 0) 66%), linear-gradient(to bottom, rgb(13 33 27 / 0.6) 0%, rgb(13 33 27 / 0) 24%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-5 pb-7 md:px-10 md:pb-12">
            <p className="text-ui font-semibold">
              {number ? `Round ${number.number} of ${number.total}` : "At the resort"}
              {round && (
                <span className="ml-3 font-medium text-paper/85">
                  {weekday(round.date)}, {monthDay(round.date)}
                </span>
              )}
            </p>
            <h1 className="display mt-2 text-[clamp(3.25rem,14vw,8rem)]">{course.name}</h1>
            <PhotoCredit photo={photo} className="mt-2 block" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 pb-16 pt-10 md:px-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <p className="serif max-w-prose text-[21px] leading-[1.5] md:text-[24px]">{course.intro}</p>

          <section aria-labelledby="expect" className="mt-12">
            <h2 id="expect" className="display text-[34px] md:text-[40px]">
              What to expect
            </h2>
            <ul className="mt-4 max-w-prose divide-y divide-rule border-y border-rule">
              {course.expect.map((line) => (
                <li key={line} className="py-4 text-ui leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose text-ui leading-relaxed">{course.clubhouse}</p>
          </section>

          {round && (
            <section aria-labelledby="our-round" className="mt-12">
              <h2 id="our-round" className="display text-[34px] md:text-[40px]">
                Our round
              </h2>
              <p className="figures mt-3 text-fact font-semibold">
                {weekday(round.date)}, {monthDay(round.date)}
              </p>
              {wind && hour >= 0 && (
                <p className="figures mt-1.5 text-meta">
                  <span className="text-moss">At the first tee time </span>
                  <span className="font-semibold">
                    {wind.point.temp[hour]}°, wind {wind.point.speed[hour]} mph from the {compass(wind.point.direction[hour])}
                    {wind.point.gust[hour] > wind.point.speed[hour] ? `, gusts ${wind.point.gust[hour]}` : ""}
                  </span>
                </p>
              )}
              {round.teeTimes.length > 0 && (
                <table className="mt-4 w-full max-w-lg text-ui">
                  <caption className="sr-only">Tee times</caption>
                  <tbody className="divide-y divide-rule border-y border-rule">
                    {round.teeTimes.map((t) => (
                      <tr key={t.time}>
                        <th scope="row" className="figures w-24 py-2.5 text-left align-top font-semibold">
                          {clock(t.time)}
                        </th>
                        <td className="py-2.5">
                          {t.players.map((p, i) => (
                            <span key={p.name} className={p.ours ? "font-semibold" : "text-moss"}>
                              {p.name}
                              {i < t.players.length - 1 && ", "}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-2 flex flex-wrap gap-x-8">
                <Link className="action" href={`/t/${trip.slug}/schedule?day=${round.date}`}>
                  {weekday(round.date)}&rsquo;s schedule
                </Link>
                <Link className="action" href={`/t/${trip.slug}/weather?day=${round.date}`}>
                  Wind that day
                </Link>
                <a className="action" href={directionsUrl(round)} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-10 lg:pt-2">
          <section aria-labelledby="card" className="bg-forest p-6 text-limestone md:p-7">
            <h2 id="card" className="display text-[28px]">
              The card
            </h2>
            <dl className="mt-4 divide-y divide-rule-light border-y border-rule-light">
              {facts.map(([name, value]) => (
                <div key={name} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-label text-mist">{name}</dt>
                  <dd className="figures text-right text-ui font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-fine text-mist">
              From{" "}
              <a className="underline underline-offset-2" href={course.source} target="_blank" rel="noreferrer">
                the resort&rsquo;s course page
              </a>
              . Length is the total of the yardages listed there.
            </p>
          </section>

          <nav aria-labelledby="more-courses">
            <h2 id="more-courses" className="display text-[28px]">
              The courses
            </h2>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {others.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/t/${trip.slug}/courses/${c.id}`}
                    aria-current={c.id === course.id ? "page" : undefined}
                    className={`flex min-h-12 items-center justify-between gap-4 py-2.5 text-ui ${
                      c.id === course.id ? "font-semibold" : "font-medium text-moss hover:text-pine"
                    }`}
                  >
                    <span>{c.name}</span>
                    {c.id === course.id ? (
                      <span className="text-label text-copper">You are here</span>
                    ) : (
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-copper" aria-hidden="true">
                        <path d="M1 1l6 6-6 6" />
                      </svg>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </article>
  );
}
