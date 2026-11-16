"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PLACES, RESORT_MAP } from "@/lib/resortMap";
import type { PublicEvent } from "@/lib/trip";

export type MapStop = {
  eventId: string;
  /** Order in the day, from 1 */
  number: number;
  title: string;
  time: string;
  type: PublicEvent["type"];
  placeId: string;
};

type View = { scale: number; x: number; y: number };

const { width: W, height: H } = RESORT_MAP;
const PAD = 108;

/** Zoom and pan that frames the given points, never showing past the map's edges. */
function frame(points: { x: number; y: number }[], cw: number, ch: number): View {
  const cover = Math.max(cw / W, ch / H);
  if (points.length === 0) return { scale: cover, x: (cw - W * cover) / 2, y: (ch - H * cover) / 2 };
  const x0 = Math.min(...points.map((p) => p.x)) - PAD;
  const x1 = Math.max(...points.map((p) => p.x)) + PAD;
  const y0 = Math.min(...points.map((p) => p.y)) - PAD;
  const y1 = Math.max(...points.map((p) => p.y)) + PAD;
  const closest = cw / 330; // never closer than ~330 map pixels across
  const scale = Math.max(cover, Math.min(cw / (x1 - x0), ch / (y1 - y0), closest));
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    scale,
    x: clamp(cw / 2 - ((x0 + x1) / 2) * scale, cw - W * scale),
    y: clamp(ch / 2 - ((y0 + y1) / 2) * scale, ch - H * scale),
  };
}

const MOVE = "transform 800ms cubic-bezier(0.2, 0.7, 0.2, 1)";

/**
 * A pin that was not on the map a moment ago waits for the map to travel most of the way
 * to its new frame, then fades in where it belongs. (Given as a ref, so it runs once.)
 */
const arrive = (el: HTMLElement | null) => {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: 800, easing: "ease-out" });
};

/**
 * The resort map for one day: home base, the day's stops in order, and a line joining
 * them, framed to the day.
 */
export function DayMap({
  stops,
  homeId,
  homeLabel,
  activeEventId,
  onSelect,
}: {
  stops: MapStop[];
  homeId: string | null;
  /** The viewer's room, by name */
  homeLabel: string | null;
  activeEventId: string | null;
  onSelect: (eventId: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // The first frame is placed, not travelled to: movement starts only once the map has
  // been drawn in position.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const settle = setTimeout(() => setSettled(true), 120);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(settle);
    };
  }, []);

  const home = homeId ? PLACES[homeId] : null;
  // Several events can share a place (dinner at the clubhouse you played from).
  const pins = [...new Set(stops.map((s) => s.placeId))].map((placeId) => ({
    place: PLACES[placeId],
    stops: stops.filter((s) => s.placeId === placeId),
  }));
  const active = stops.find((s) => s.eventId === activeEventId) ?? null;

  // The lodging's label sits to its right, so the frame keeps room for it there.
  const homeRoom = home ? [home, { x: Math.min(W, home.x + 120), y: home.y }] : [];
  const view = size
    ? frame(active ? [PLACES[active.placeId], ...homeRoom] : [...pins.map((p) => p.place), ...homeRoom], size.w, size.h)
    : null;
  const at = (p: { x: number; y: number }) =>
    view ? `translate(${p.x * view.scale + view.x}px, ${p.y * view.scale + view.y}px)` : undefined;

  // Keep labels within the instrument, including clubhouses shared by several events.
  const labelAt = (p: { x: number; y: number }, text: string, prefer: "left" | "right" = "left") => {
    if (!size || !view) return {};
    const x = p.x * view.scale + view.x;
    const width = Math.min(220, text.length * 7 + 16, size.w - 48);
    const fitsLeft = x > width + 30;
    const fitsRight = x + width + 30 < size.w;
    return {
      width,
      left: (prefer === "right" ? fitsRight : !fitsLeft && fitsRight) ? 24 : fitsLeft ? -width - 24 : Math.max(8 - x, Math.min(-width / 2, size.w - x - width - 8)),
      top: fitsLeft || fitsRight ? 0 : -38,
    };
  };

  // Home, then each stop in order: the shape of the day, not a walking route.
  const path = [...(home ? [home] : []), ...stops.map((s) => PLACES[s.placeId])];

  return (
    <figure className="day-map-figure">
      <div ref={box} className="relative isolate aspect-square overflow-hidden bg-forest-deep sm:aspect-[4/3] lg:aspect-[5/6]">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: W,
            height: H,
            transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : undefined,
            transition: settled ? MOVE : "none",
            opacity: view ? 1 : 0,
          }}
        >
          <Image
            src={RESORT_MAP.src}
            alt="Map of Bandon Dunes Golf Resort"
            width={W}
            height={H}
            unoptimized
            priority
            className="block h-full w-full max-w-none select-none"
            draggable={false}
          />
          {path.length > 1 && (
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              {/* A light casing under a dashed line, so it reads over both grass and water */}
              <polyline
                points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#f3f1ec"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity="0.75"
              />
              <polyline
                points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#0d211b"
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>

        {view && (
          <>
            {home && (
              <span className="absolute left-0 top-0" style={{ transform: at(home), transition: settled ? MOVE : "none" }}>
                <span className="absolute -left-4 -top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-paper bg-forest text-limestone shadow-md">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 7.5L8 3l5.5 4.5V13h-11z" />
                  </svg>
                </span>
                <span style={labelAt(home, home.name.replace(/ clubhouse$/, ""), "right")} className="absolute -translate-y-1/2 bg-forest px-2 py-1 text-center text-[12px] font-semibold text-limestone shadow-md">
                  {home.name.replace(/ clubhouse$/, "")}
                </span>
              </span>
            )}

            {pins.map(({ place, stops: here }) => {
              const on = here.some((s) => s.eventId === activeEventId);
              const golf = here.some((s) => s.type === "golf");
              return (
                <button
                  key={place.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${here.map((s) => s.title).join(" and ")}, ${place.name}`}
                  onClick={() => onSelect(on ? null : here[0].eventId)}
                  ref={arrive}
                  className="group absolute left-0 top-0 z-10"
                  style={{ transform: at(place), transition: settled ? MOVE : "none" }}
                >
                  {/* A 44px target around a smaller dot */}
                  <span className="absolute left-0 top-0 flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                    <span
                      className={`figures flex h-8 min-w-8 items-center justify-center gap-1 whitespace-nowrap rounded-full border-2 border-paper px-2 text-label font-bold shadow-md transition-transform duration-200 ${
                        golf ? "bg-forest-deep text-paper" : "bg-copper text-paper"
                      } ${on ? "scale-125" : "group-hover:scale-110"}`}
                    >
                      {here.map((s, i) => (
                        <span key={s.eventId} className={i > 0 ? "border-l border-paper/50 pl-1.5" : ""}>
                          {s.number}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span
                    style={labelAt(place, here.map(s => s.title).join(", "))}
                    className={`absolute -translate-y-1/2 px-2 py-1 text-center text-[12px] font-semibold shadow-md ${
                      on ? "bg-forest-deep text-paper" : "bg-paper text-pine"
                    }`}
                  >
                    {here.map((s) => s.title).join(", ")}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      <ol className="divide-y divide-rule border-b border-rule">
        {home && (
          <li className="flex min-h-12 items-center gap-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-limestone">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 7.5L8 3l5.5 4.5V13h-11z" />
              </svg>
            </span>
            <span className="text-meta font-semibold">{homeLabel ?? home.name}</span>
            <span className="ml-auto text-meta text-moss">Where you&rsquo;re staying</span>
          </li>
        )}
        {stops.map((s) => {
          const on = s.eventId === activeEventId;
          return (
            <li key={s.eventId}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onSelect(on ? null : s.eventId);
                }}
                className={`flex min-h-12 w-full items-center gap-3 py-2 text-left transition-colors ${on ? "text-forest" : "hover:text-forest"}`}
              >
                <span
                  className={`figures flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label font-bold text-paper ${
                    s.type === "golf" ? "bg-forest-deep" : "bg-copper"
                  } ${on ? "ring-2 ring-copper ring-offset-2 ring-offset-limestone" : ""}`}
                >
                  {s.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-meta font-semibold">{s.title}</span>
                  <span className="block text-label text-moss">{PLACES[s.placeId].name}</span>
                </span>
                <span className="figures ml-auto shrink-0 text-meta font-semibold">{s.time}</span>
              </button>
            </li>
          );
        })}
      </ol>
    <figcaption className="mt-3 text-fine text-moss">Stops in itinerary order. Connecting lines are not walking routes.</figcaption>
    </figure>
  );
}
