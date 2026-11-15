import { useId } from "react";
import { interpolate, timelineLabel } from "@/lib/windMath";
import type { WindData } from "@/lib/wind";
import type { WindEvent } from "./WindExplorer";

// The plot's drawing space. The top band is the lane where the day's events are flagged;
// the curves sit below it. Both share one time axis, so a flag stands over its hours.
const W = 1000;
const H = 90;
const LANE = 30;
const FLOOR = H - 2;

const FLAG_ICONS: Record<string, string> = {
  golf: "M5 14V2.5l7 2.7L5 8",
  dining: "M4 2v4.5a1.5 1.5 0 003 0V2M5.5 8v6M11.5 14V2c-1.6 1.2-2.2 3.2-2.2 5.5h2.2",
};

/**
 * The forecast plot and its scrubber, which share exactly the same time domain, with the
 * events of that span flagged along the top. A flag carries the same look as its pin on
 * the map, and turns copper with it.
 */
export function ForecastTimeline({ data, events, time, from, to, nights, selected, onChange, onEvent }: {
  data: WindData; events: WindEvent[]; time: number; from: number; to: number;
  nights: [number, number][];
  /** Whether each event reads as the current one */
  selected: (e: WindEvent) => boolean;
  onChange: (time: number) => void;
  onEvent: (e: WindEvent) => void;
}) {
  const id = useId();
  const { speed, gust } = data.point;
  const end = Math.max(from + 1, to - 1);
  const span = end - from;
  const peak = Math.ceil(Math.max(10, ...gust.slice(from, to), ...speed.slice(from, to)) / 10) * 10;
  const x = (hour: number) => ((hour - from) / span) * W;
  const y = (value: number) => FLOOR - (value / peak) * (FLOOR - LANE - 6);
  const pct = (hour: number) => Math.max(0, Math.min(100, ((hour - from) / span) * 100));
  const line = (values: number[]) => values.slice(from, to).map((v, i) => `${i ? "L" : "M"}${x(from + i)},${y(v)}`).join(" ");
  const cursor = pct(time);
  const ticks = span > 24 ? 24 : 6;

  // Each flag gets the room up to the next one. The last, when it sits near the end of
  // the span, hangs its label to the left of its mark and splits the gap with the one
  // before it.
  const shown = events.filter((e) => e.start >= from && e.start < to);
  const flags = shown.map((e, i) => {
    const at = pct(e.start);
    const prev = i > 0 ? pct(shown[i - 1].start) : 0;
    const next = i < shown.length - 1 ? pct(shown[i + 1].start) : 100;
    const last = i === shown.length - 1;
    const flip = last && 100 - at < 14 && shown.length > 1;
    const beforeFlip = i === shown.length - 2 && 100 - pct(shown[i + 1].start) < 14;
    const room = flip ? (at - prev) / 2 : beforeFlip ? (next - at) / 2 : last ? 100 - at : next - at;
    return { e, at, room, flip };
  });

  // "Wind" sits under its line unless that would drop it off the plot; "Gusts" sits over
  // its line, nudged up clear of "Wind" when the two lines run close.
  const windY = y(speed[from]);
  const windBelow = windY < FLOOR - 14;
  const gustY = Math.min(y(gust[from]), windBelow ? windY - 2 : windY - 13);
  return (
    <div className="wind-plot">
      <div className="wind-plot-axis" aria-hidden="true">
        {[peak, peak / 2, 0].map((v) => (
          <span key={v} style={{ top: `${(y(v) / H) * 100}%` }}>
            {v}
            {v === peak && <small> mph</small>}
          </span>
        ))}
      </div>
      <div className="wind-plot-field">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id={id}><rect width={W} height={H} /></clipPath></defs>
          <g clipPath={`url(#${id})`}>
            {nights.map(([a, b]) => <rect key={a} className="wind-plot-night" x={x(a)} width={Math.max(0, x(b) - x(a))} height={H} />)}
            {[0, peak / 2, peak].map(v => <line key={v} className="wind-plot-grid" x1="0" x2={W} y1={y(v)} y2={y(v)} vectorEffect="non-scaling-stroke" />)}
            <path className="wind-plot-gust-area" d={`${line(gust)} L${W},${FLOOR} L0,${FLOOR} Z`} />
            <path className="wind-plot-gust" d={line(gust)} vectorEffect="non-scaling-stroke" />
            <path className="wind-plot-wind-area" d={`${line(speed)} L${W},${FLOOR} L0,${FLOOR} Z`} />
            <path className="wind-plot-wind" d={line(speed)} vectorEffect="non-scaling-stroke" />
            {flags.map(({ e }) => e.end > e.start && (
              <rect key={e.id} className={`wind-plot-span ${selected(e) ? "is-on" : ""} ${e.sunsetNote ? "is-late" : ""}`}
                x={x(e.start)} y={LANE - 3} width={Math.max(3, x(e.end) - x(e.start))} height="2" />
            ))}
            <line className="wind-plot-cursor" x1={cursor * 10} x2={cursor * 10} y1={LANE - 6} y2={H} vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        {/* The two curves name themselves at the start of the span, in place of a key. */}
        <span className="wind-plot-name is-above" style={{ top: `${(gustY / H) * 100}%` }} aria-hidden="true">Gusts</span>
        <span className={`wind-plot-name is-wind ${windBelow ? "is-below" : "is-above"}`} style={{ top: `${(windY / H) * 100}%` }} aria-hidden="true">Wind</span>
        <span className="wind-plot-point" style={{ left: `${cursor}%`, top: `${(y(interpolate(speed, time)) / H) * 100}%` }} />
        <input type="range" min={from} max={to - 1} step={1 / 60} value={Math.min(to - 1, Math.max(from, time))}
          onChange={e => onChange(Number(e.target.value))} aria-label="Forecast time" aria-valuetext={timelineLabel(data.times, time)} />
        <ul className="wind-lane" aria-label="Itinerary destinations">
          {flags.map(({ e, at, room, flip }) => (
            <li key={e.id} className={flip ? "is-flipped" : ""}
              style={flip ? { right: `${100 - at}%`, width: `${room}%` } : { left: `${at}%`, width: `${room}%` }}>
              <button type="button" aria-pressed={selected(e)} onClick={() => onEvent(e)}
                aria-label={`${e.title}, ${e.label}${e.sunsetNote ? `. ${e.sunsetNote}` : ""}`} title={`${e.title} · ${e.label}`}>
                <span className="wind-flag-mark">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {FLAG_ICONS[e.type] ? <path d={FLAG_ICONS[e.type]} /> : <circle cx="8" cy="8" r="2.5" fill="currentColor" />}
                  </svg>
                </span>
                <span className="wind-flag-name">{e.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="wind-plot-ticks" aria-hidden="true">
          {Array.from({length: Math.floor(span / ticks) + 1}, (_, i) => {
            const hour = from + i * ticks;
            const local = data.times[hour];
            return <span key={hour} style={{left: `${(hour - from) / span * 100}%`}}>{span > 24 ? new Intl.DateTimeFormat("en-US", {weekday: "short", timeZone: "UTC"}).format(new Date(`${local}Z`)) : i === 0 ? "12 AM" : i === 2 ? "Noon" : `${i * 6 % 12 || 12} ${i < 2 ? "AM" : "PM"}`}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
