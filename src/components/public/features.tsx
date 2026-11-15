import Link from "next/link";
import { monthDay, monthDayShort, weekday, weekdayShort } from "@/lib/time";
import { eventTimes, teeLabel, type PublicEvent } from "@/lib/trip";
import type { DayWeather } from "@/lib/weather";
import { TypeGlyph, WeatherGlyph, WindGlyph } from "./Glyphs";
import { Photo, PhotoCredit, type PhotoData } from "./Photo";

export type RoundInfo = { number: number; total: number; par: number };

const DEEP = "13 33 27";

/**
 * Shade only where type sits on a photograph: the lower part for the title block, and a
 * thin band at the top for the small labels. The middle of the picture stays untouched.
 */
export function Scrim({ top = true }: { top?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background: [
          `linear-gradient(to top, rgb(${DEEP} / 0.9) 0%, rgb(${DEEP} / 0.62) 26%, rgb(${DEEP} / 0) 58%)`,
          top ? `linear-gradient(to bottom, rgb(${DEEP} / 0.5) 0%, rgb(${DEEP} / 0) 24%)` : "",
        ]
          .filter(Boolean)
          .join(", "),
      }}
    />
  );
}

/** The day's playing conditions as labelled figures: temperature, wind, gusts, rain. */
export function Conditions({
  weather,
  tone = "dark",
  grid = false,
  className = "",
}: {
  /** Two columns instead of one row, for narrow panels: always, or ("phone")
   *  whenever the surrounding container is narrower than 24rem */
  grid?: boolean | "phone";
  weather: DayWeather;
  /** "dark" sits on forest green, "light" on limestone */
  tone?: "dark" | "light";
  className?: string;
}) {
  const label = tone === "dark" ? "text-mist" : "text-moss";
  const cells: [string, React.ReactNode][] = [
    [
      weather.label,
      <span key="t" className="inline-flex items-center gap-1.5">
        <WeatherGlyph kind={weather.kind} size={20} />
        {weather.high}° / {weather.low}°
      </span>,
    ],
    ["Wind", `${weather.wind} mph`],
  ];
  if (weather.gust !== null) cells.push(["Gusts", `${weather.gust} mph`]);
  if (weather.rainChance !== null) cells.push(["Rain", `${weather.rainChance}%`]);
  return (
    <dl
      className={`${
        grid === "phone"
          ? "grid grid-cols-2 @sm:flex @sm:flex-wrap @sm:justify-between"
          : grid
            ? "grid grid-cols-2"
            : "flex flex-wrap justify-between"
      } gap-x-5 gap-y-3 ${className}`}
    >
      {cells.map(([name, value]) => (
        <div key={name} className="flex flex-col-reverse">
          <dt className={`text-label ${label}`}>{name}</dt>
          <dd className="figures whitespace-nowrap text-ui font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type CourseProps = {
  event: PublicEvent;
  photo: PhotoData;
  slot: string;
  round: RoundInfo | null;
  weather?: DayWeather;
  href: string;
  className?: string;
  sizes?: string;
};

/** A course as a destination: the photograph carries its name, day and tee times. */
export function CourseCard({ event, photo, slot, round, weather, href, className = "", sizes }: CourseProps) {
  return (
    <Link
      href={href}
      className={`group relative isolate block overflow-hidden bg-forest-deep text-paper ${className}`}
    >
      <Photo
        photo={photo}
        slot={slot}
        sizes={sizes}
        className="transition-transform duration-[900ms] ease-settle group-hover:scale-[1.035]"
      />
      <Scrim />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 text-meta font-semibold md:p-7">
        <span>{round ? `Round ${round.number} of ${round.total}` : "Golf"}</span>
        {weather && (
          <span className="figures inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <WeatherGlyph kind={weather.kind} size={20} />
              {weather.high}°
            </span>
            <span className="inline-flex items-center gap-1.5 md:max-lg:hidden">
              <WindGlyph size={18} />
              {weather.wind} mph
            </span>
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
        <h3 className="display text-[clamp(2.25rem,9vw,3.5rem)]">{event.title}</h3>
        <p className="figures mt-3 flex flex-col gap-x-4 text-ui font-semibold sm:flex-row sm:flex-wrap">
          <span>
            {weekday(event.date)}, {monthDay(event.date)}
          </span>
          {event.startTime && <span>{eventTimes(event)}</span>}
        </p>
        <PhotoCredit photo={photo} className="mt-2 block" />
      </div>
    </Link>
  );
}

/** The lead course, given room: a large photograph beside its details. Desktop only. */
export function CourseFeature({ event, photo, slot, round, weather, href, className = "", sizes }: CourseProps) {
  const rows: [string, string][] = [["Day", `${weekday(event.date)}, ${monthDay(event.date)}`]];
  if (event.startTime) rows.push([teeLabel(event), eventTimes(event)]);
  return (
    <Link href={href} className={`group grid-cols-12 bg-forest text-limestone ${className}`}>
      <div className="relative isolate col-span-8 min-h-[540px] overflow-hidden bg-forest-deep">
        <Photo
          photo={photo}
          slot={slot}
          sizes={sizes}
          className="transition-transform duration-[900ms] ease-settle group-hover:scale-[1.03]"
        />
        <PhotoCredit photo={photo} className="absolute bottom-3 left-4" />
      </div>
      <div className="col-span-4 flex flex-col justify-between gap-8 p-8 lg:p-10">
        <div>
          <p className="text-meta font-semibold text-copper-light">
            {round ? `Round ${round.number} of ${round.total}` : "Golf"}
          </p>
          <h3 className="display mt-3 text-[clamp(2.75rem,4.6vw,4.25rem)]">{event.title}</h3>
        </div>
        <div>
          <dl className="divide-y divide-rule-light border-y border-rule-light">
            {rows.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-label text-mist">{name}</dt>
                <dd className="figures text-right text-ui font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {weather && <Conditions weather={weather} grid className="mt-5" />}
          <p className="mt-6 text-meta font-semibold underline decoration-copper-light decoration-1 underline-offset-[5px] group-hover:text-copper-light">
            About the course
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Daily temperature ranges share a scale; the forecast remains readable without the graphic. */
export function ForecastStrip({ days, weather, today, playing = {} }: {
  days: string[]; weather: Record<string, DayWeather>; today?: string;
  playing?: Record<string, string>;
}) {
  const available = days.map(date => weather[date]).filter(Boolean);
  const low = Math.min(...available.map(w => w.low)) - 2;
  const high = Math.max(...available.map(w => w.high)) + 2;
  const extent = Math.max(1, high - low);
  return <ol className="forecast-board" style={{ "--days": days.length } as React.CSSProperties}>
    {days.map(date => {
      const w = weather[date];
      return <li key={date}>
        <Link className="forecast-day" href={`/wind?day=${date}`}>
          <span className="sr-only">Explore hourly wind for </span><div className="forecast-day-heading"><strong className={date === today ? "text-copper-light" : ""}>{date === today ? "Today" : weekdayShort(date)}, {monthDayShort(date)}</strong><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" /></svg></div>
          <p className="forecast-course">{playing[date]}</p>
          {w ? <>
            <div className="forecast-temperature"><WeatherGlyph kind={w.kind} size={32} /><span className="display figures">{w.high}°</span><span className="text-mist">{w.label}</span></div>
            <div className="forecast-range"><span>{w.low}°</span><div aria-hidden="true"><i style={{ left: `${(w.low - low) / extent * 100}%`, width: `${(w.high - w.low) / extent * 100}%` }} /></div><span>{w.high}°</span></div>
            <dl className="forecast-measures">
              <div><dt>Wind</dt><dd>{w.wind} <span>mph</span></dd></div>
              {w.gust !== null && <div><dt>Gusts</dt><dd>{w.gust} <span>mph</span></dd></div>}
              {w.rainChance !== null && <div><dt>Rain</dt><dd>{w.rainChance}<span>%</span></dd></div>}
            </dl>
          </> : <p className="py-8 text-mist">No forecast yet</p>}
        </Link>
      </li>;
    })}
  </ol>;
}

/** What marks an event's kind when it has no photograph, or beside one. */
export function TypeMark({ type, size = 48 }: { type: PublicEvent["type"]; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full ${
        type === "golf"
          ? "bg-forest text-limestone"
          : type === "dining"
            ? "bg-copper/15 text-copper"
            : "bg-pine/10 text-pine"
      }`}
    >
      <TypeGlyph type={type} size={Math.round(size * 0.44)} />
    </span>
  );
}

/** A compact line for a meal or activity: small picture, name, and when. */
export function EventRow({
  event,
  photo = null,
  slot,
  showDay = false,
  summary,
  note,
  href,
}: {
  event: PublicEvent;
  photo?: PhotoData;
  slot?: string;
  showDay?: boolean;
  summary: string;
  note?: string | null;
  href?: string;
}) {
  const body = (
    <>
      {photo && slot ? (
        <span className="relative block h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden bg-forest-deep">
          <Photo photo={photo} slot={slot} sizes="72px" />
        </span>
      ) : (
        <TypeMark type={event.type} />
      )}
      <span className="min-w-0 flex-1">
        <span className="serif block text-[22px] leading-tight">{event.title}</span>
        <span className="figures mt-1 block text-ui font-semibold sm:hidden">
          {showDay && <span className="mr-1.5 text-copper">{weekdayShort(event.date)}</span>}
          {event.startTime ? eventTimes(event) : "All day"}
        </span>
        {summary && <span className="mt-0.5 block text-meta text-moss sm:mt-1">{summary}</span>}
        {note && <span className="block text-meta text-moss">{note}</span>}
      </span>
      <span className="figures hidden shrink-0 text-right text-ui font-semibold sm:block">
        {showDay && <span className="block text-meta font-medium text-copper">{weekdayShort(event.date)}</span>}
        {event.startTime ? eventTimes(event) : "All day"}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-[4.5rem] items-center gap-4 py-4 transition-colors hover:text-forest">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-[4.5rem] items-center gap-4 py-4">{body}</div>
      )}
    </li>
  );
}
