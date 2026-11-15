import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo, PhotoCredit } from "@/components/public/Photo";
import { COURSES, courseById } from "@/data/courses";
import { photoFor, slotFor, slotName } from "@/lib/photos";
import { clock, monthDay, weekday } from "@/lib/time";
import { roundNumbers } from "@/lib/trip";
import { getTrip } from "@/lib/viewer";
import { getWind } from "@/lib/wind";
import { forecastSummary, minutesFromStart } from "@/lib/windMath";

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
  const minute = wind && round?.startTime ? minutesFromStart(wind.times, `${round.date}T${round.startTime}`) : -1;
  const forecast = wind && minute >= 0 ? forecastSummary(wind.point, minute / 60) : null;

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
    <article className="course-page">
      <header className="course-cover relative isolate h-[46svh] min-h-[320px] overflow-hidden bg-forest-deep text-paper md:h-[62svh]">
        <div className="arrival-photo absolute inset-0"><Photo photo={photo} slot={`courses/${course.id}`} priority sizes="100vw" /></div>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(13 33 27 / 0.92) 0%, rgb(13 33 27 / 0.62) 30%, rgb(13 33 27 / 0) 66%), linear-gradient(to bottom, rgb(13 33 27 / 0.82) 0%, rgb(13 33 27 / 0) 38%)",
          }}
        />
        <Link className="course-back" href={`/t/${trip.slug}#courses`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h15" /></svg>All courses</Link>
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-5 pb-7 md:px-10 md:pb-12">
            <p className="course-cover-meta text-ui font-semibold">
              {number ? `Round ${number.number} of ${number.total}` : "At the resort"}
              {round && (
                <span className="ml-3 font-medium text-paper/85">
                  {weekday(round.date)}, {monthDay(round.date)}
                </span>
              )}
            </p>
            <h1 className="display mt-2 text-[clamp(3.25rem,12vw,6rem)]">{course.name}</h1>
            <PhotoCredit photo={photo} className="mt-2 block" />
          </div>
        </div>
      </header>

      <div className="course-card-strip"><dl>{facts.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></div>
      <nav className="course-chapters" aria-label="On this course page"><div>
        <a href="#course-overview">The course</a><a href="#expect">What to expect</a>{round && <a href="#your-round">Your round</a>}
        <Link href={`/t/${trip.slug}/weather${round ? `?day=${round.date}` : ""}`}>Wind map <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" /></svg></Link>
      </div></nav>

      <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-5 pb-16 pt-10 md:px-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div id="course-overview" className="min-w-0">
          <p className="course-intro serif max-w-prose text-[23px] leading-[1.5] md:text-[28px]">{course.intro}</p>

          <section aria-labelledby="expect" className="mt-12">
            <h2 id="expect" className="display text-[34px] md:text-[40px]">
              What to expect
            </h2>
            <ul className="mt-4 max-w-prose divide-y divide-rule border-y border-rule">
              {course.expect.map((line) => (
                <li key={line} className="course-expectation py-5 text-ui leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            <div className="course-clubhouse"><h3 className="serif text-[24px]">At the clubhouse</h3><p className="mt-2 text-ui leading-relaxed">{course.clubhouse}</p></div>
            <p className="mt-6 text-fine text-moss">Course facts from <a className="underline underline-offset-2" href={course.source} target="_blank" rel="noreferrer">the resort’s course page</a>. Length is the total of its listed yardages.</p>
          </section>


        </div>

        <aside className="course-sidebar space-y-10 lg:self-start">
          {round && (
            <section id="your-round" aria-labelledby="our-round" className="course-round">
              <h2 id="our-round" className="display text-[34px]">
                Your round
              </h2>
              <p className="figures mt-3 text-ui font-semibold">
                {weekday(round.date)}, {monthDay(round.date)}
              </p>
              {forecast && (
                <p className="figures mt-1.5 text-meta">
                  <span className="text-moss">At the first tee time </span>
                  <span className="font-semibold">
                    {forecast}
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
              </div>
            </section>
          )}

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
                    className={`course-related flex min-h-12 items-center justify-between gap-4 py-3 text-ui ${
                      c.id === course.id ? "font-semibold" : "font-medium text-moss hover:text-pine"
                    }`}
                  >
                    <span className="course-related-photo"><Photo photo={photoFor(`courses/${c.id}`)} slot={`courses/${c.id}`} sizes="64px" /></span>
                    <span className="flex-1">{c.name}</span>
                    {c.id === course.id ? (
                      <span className="text-label text-copper">Current course</span>
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
