import { useId } from "react";
import { interpolate, timelineLabel } from "@/lib/windMath";
import type { WindData } from "@/lib/wind";
import type { WindEvent } from "./WindExplorer";

/** The plot and range control share precisely the same time domain. */
export function ForecastTimeline({ data, events, time, from, to, nights, onChange }: {
  data: WindData; events: WindEvent[]; time: number; from: number; to: number;
  nights: [number, number][]; onChange: (time: number) => void;
}) {
  const id = useId();
  const { speed, gust } = data.point;
  const end = Math.max(from + 1, to - 1);
  const span = end - from;
  const peak = Math.ceil(Math.max(10, ...gust.slice(from, to), ...speed.slice(from, to)) / 10) * 10;
  const x = (hour: number) => ((hour - from) / span) * 1000;
  const y = (value: number) => 104 - (value / peak) * 82;
  const line = (values: number[]) => values.slice(from, to).map((v, i) => `${i ? "L" : "M"}${x(from + i)},${y(v)}`).join(" ");
  const cursor = Math.max(0, Math.min(100, (time - from) / span * 100));
  const ticks = span > 24 ? 24 : 6;
  return (
    <div className="wind-plot">
      <div className="wind-plot-axis" aria-hidden="true"><span>{peak}</span><span>{peak / 2}</span><span>0</span></div>
      <div className="wind-plot-field">
        <svg viewBox="0 0 1000 112" preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id={id}><rect width="1000" height="112" /></clipPath></defs>
          <g clipPath={`url(#${id})`}>
            {nights.map(([a, b]) => <rect key={a} x={x(a)} width={Math.max(0, x(b) - x(a))} height="112" fill="rgb(0 0 0 / .25)" />)}
            {[0, peak / 2, peak].map(v => <line key={v} x1="0" x2="1000" y1={y(v)} y2={y(v)} stroke="rgb(233 231 224 / .14)" vectorEffect="non-scaling-stroke" />)}
            {events.filter(e => e.type === "golf" || e.sunsetNote).map(e => <rect key={e.id} x={x(e.start)} y="2" width={Math.max(3, x(e.end) - x(e.start))} height="3" fill={e.sunsetNote ? "#d99a6c" : "#e9e7e0"} />)}
            <path d={`${line(gust)} L1000,104 L0,104 Z`} fill="rgb(195 208 205 / .07)" />
            <path d={line(gust)} fill="none" stroke="#c3d0cd" strokeOpacity=".7" strokeWidth="1.25" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={`${line(speed)} L1000,104 L0,104 Z`} fill="rgb(195 208 205 / .13)" />
            <path d={line(speed)} fill="none" stroke="#e9e7e0" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <line x1={cursor * 10} x2={cursor * 10} y1="0" y2="112" stroke="#d99a6c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <span className="wind-plot-point" style={{ left: `${cursor}%`, top: `${y(interpolate(speed, time)) / 112 * 100}%` }} />
        <input type="range" min={from} max={to - 1} step={1 / 60} value={Math.min(to - 1, Math.max(from, time))}
          onChange={e => onChange(Number(e.target.value))} aria-label="Forecast time" aria-valuetext={timelineLabel(data.times, time)} />
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
