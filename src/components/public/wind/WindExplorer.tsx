"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WindData } from "@/lib/wind";
import { courseFor, HOLES } from "@/lib/holes";
import { describe } from "@/lib/weatherCodes";
import { compass, interpolate, interpolateDirection, timelineLocal, minutesFromStart, SPEED_STOPS, windOnHole } from "@/lib/windMath";
import { WeatherGlyph, WindGlyph } from "../Glyphs";
import { aerialStyle } from "./aerial";
import { WindParticles } from "./particles";

export type WindEvent = {
  id: string;
  title: string;
  type: string;
  /** Hours from the first hour of the data, fractional */
  start: number;
  end: number;
  /** When the player is taken to have left: see the wind page for the lengths assumed */
  until: number;
  label: string;
  place: [number, number] | null;
  /** The map place this happens at, when it is on the map */
  placeId: string | null;
  /** Set when the sun goes down while this is still going: "Sunset 4:49 PM" */
  sunsetNote: string | null;
};

export type WindPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  home: boolean;
  /** What the pin's icon shows */
  kind: "home" | "golf" | "dining" | "other";
  /** Which side of its dot the label sits on, so close neighbours don't overlap */
  side: "left" | "right";
};

const CELL = 18; // spacing of the on-screen wind grid, px

/** The hours the dock's strip offers for each day: 6 AM to 9 PM. */
const FIRST_HOUR = 6;
const LAST_HOUR = 21;

/** 10.3333 (hours, any day) → "10:20 AM" */
const clockAt = (hours: number) => {
  const m = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
};
const hourName = (h: number) => (h === 12 ? "Noon" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`);
const weekday = (date: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** The drawing inside a pin's badge, by what is there. */
const ICONS = {
  home: '<path d="M2.5 7.5L8 3l5.5 4.5V13h-11z"/>',
  golf: '<path d="M5 14V2.5l7 2.7L5 8"/>',
  dining: '<path d="M4 2v4.5a1.5 1.5 0 003 0V2M5.5 8v6M11.5 14V2c-1.6 1.2-2.2 3.2-2.2 5.5h2.2"/>',
  other: '<circle cx="8" cy="8" r="2.5" fill="currentColor"/>',
};
const kindOf = (type: string): keyof typeof ICONS => (type === "golf" ? "golf" : type === "dining" ? "dining" : "other");

/**
 * The dock's outline: a rounded panel whose top edge rises into a hump at the centre, where
 * the compass sits. Drawn for the panel's measured size so the hump never stretches.
 */
const RISE = 48;
const dockPath = (w: number, h: number) => {
  const c = w / 2;
  return `M0 ${RISE + 26} Q0 ${RISE} 26 ${RISE} L${c - 127} ${RISE} C${c - 87} ${RISE} ${c - 77} 0 ${c} 0 C${c + 77} 0 ${c + 87} ${RISE} ${c + 127} ${RISE} L${w - 26} ${RISE} Q${w} ${RISE} ${w} ${RISE + 26} L${w} ${h - 26} Q${w} ${h} ${w - 26} ${h} L26 ${h} Q0 ${h} 0 ${h - 26} Z`;
};

/** Every layer that draws the holes, shown or hidden together by the holes button. */
const HOLE_LAYERS = ["holes-outline-fill", "holes-outline", "holes-green", "holes-line", "holes-number", "holes-number-on"];
/** Where this device remembers whether the holes are shown. */
const HOLES_KEY = "wind-holes";

/** A hole on the map: its course and number. */
type HoleRef = { course: string; n: number };
const holeKey = (h: HoleRef | null | undefined) => (h ? `${h.course}/${h.n}` : "");
/** Where a hole's reading sits: halfway along its line of play. */
const holeMiddle = ({ course, n }: HoleRef): [number, number] | null => {
  const line = HOLES[course]?.holes.find((h) => h.n === n)?.line;
  if (!line) return null;
  const a = line[Math.floor((line.length - 1) / 2)];
  const b = line[Math.ceil((line.length - 1) / 2)];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
};

/**
 * Every hole as map features: its line of play, its green, and a numbered badge at the
 * tee. `today` marks the courses being played on the chosen day, which show at any zoom;
 * the rest come in as the map is zoomed in. `on` is the hole whose reading is open; with
 * one open, the others are marked `dim`.
 */
function holeFeatures(today: string[], on: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const [course, { holes }] of Object.entries(HOLES)) {
    for (const hole of holes) {
      const key = holeKey({ course, n: hole.n });
      // With a hole open, every other hole steps back to context.
      const properties = { course, n: hole.n, today: today.includes(course), on: key === on, dim: !!on && key !== on };
      if (hole.green) features.push({ type: "Feature", properties: { ...properties, part: "green" }, geometry: { type: "Polygon", coordinates: [hole.green] } });
      // The hole's outline is only drawn for the open hole, so only that one is sent.
      if (key === on) for (const polygon of hole.outline) features.push({ type: "Feature", properties: { ...properties, part: "outline" }, geometry: { type: "Polygon", coordinates: polygon } });
      features.push({ type: "Feature", properties, geometry: { type: "LineString", coordinates: hole.line } });
      features.push({ type: "Feature", properties, geometry: { type: "Point", coordinates: hole.line[0] } });
    }
  }
  return { type: "FeatureCollection", features };
}
/**
 * Opacity for a hole feature: `on` for the open hole; `near` on today's courses and `far`
 * on the others, which fade in from zoom 14.8; and `dim` for every other hole while one
 * is open, so the open one stands out by contrast.
 */
const HOLES_FROM_ZOOM = 14.8;
const holeOpacity = ({ on, near, far, dim }: { on: number; near: number; far: number; dim: number }): ExpressionSpecification => [
  "interpolate", ["linear"], ["zoom"],
  HOLES_FROM_ZOOM, ["case", ["get", "on"], on, ["get", "today"], ["case", ["get", "dim"], dim, near], 0],
  HOLES_FROM_ZOOM + 0.7, ["case", ["get", "on"], on, ["get", "dim"], dim, ["get", "today"], near, far],
];
/** A hole's number in a small round badge (larger and copper when open), drawn at twice the size for sharp screens. */
function holeBadge(n: number, on: boolean, font: string): ImageData {
  const k = 2;
  const size = (on ? 30 : 22) * k;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5 * k, 0, Math.PI * 2);
  ctx.fillStyle = on ? "#b8703f" : "rgba(13, 33, 27, 0.92)";
  ctx.fill();
  ctx.lineWidth = 1.5 * k;
  ctx.strokeStyle = on ? "#f4d9c4" : "rgba(236, 238, 232, 0.9)";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `${on ? 700 : 600} ${(on ? 14 : 11) * k}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), size / 2, size / 2 + 0.75 * k);
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Where a reading sits on screen, and the clear part of the map it has to stay in (`floor`
 * is where the dock begins). For a hole, also which way its line runs; and the point is
 * the one on the line of play nearest its middle that is in the clear, so the card never
 * hangs off a point hidden behind the dock or off the screen.
 */
type Spot = { x: number; y: number; dx: number; dy: number; w: number; floor: number; top: number; bottom: number };
function spotOf(m: MapLibre, probe: { lng: number; lat: number; hole?: HoleRef }, floor: number): Spot {
  const box = m.getContainer();
  const w = box.clientWidth;
  const line = probe.hole && HOLES[probe.hole.course]?.holes.find((h) => h.n === probe.hole!.n)?.line;
  if (!line) {
    const { x, y } = m.project([probe.lng, probe.lat]);
    return { x, y, dx: 0, dy: 1, w, floor, top: y, bottom: y };
  }
  const pts = line.map((p) => m.project(p));
  // Points along the line, by share of its length on screen.
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const at = (share: number) => {
    let left = share * total;
    for (let i = 0; i < lengths.length; i++) {
      if (left <= lengths[i] || i === lengths.length - 1) {
        const f = lengths[i] ? Math.min(1, left / lengths[i]) : 0;
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
      }
      left -= lengths[i];
    }
    return pts[0];
  };
  const shares = Array.from({ length: 21 }, (_, i) => i / 20).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
  const clear = shares.map(at).find((p) => p.x > 16 && p.x < w - 16 && p.y > 72 && p.y < floor - 12) ?? at(0.5);
  const tee = pts[0];
  const green = pts[pts.length - 1];
  const ys = pts.map((p) => p.y);
  return { x: clear.x, y: clear.y, dx: green.x - tee.x, dy: green.y - tee.y, w, floor, top: Math.min(...ys), bottom: Math.max(...ys) };
}
/**
 * Where a hole's card goes: beside its line of play rather than over it, so the landing
 * area and green stay clear. A line running up the screen puts the card to one side, far
 * enough out that a slanting line doesn't run under it; a line running across puts it
 * above or below. `gap` is how far the card sits from the point on the line.
 */
const CARD = { w: 272, h: 98 };
/**
 * The hole card's outline: the dock's shape in small, a rounded panel whose top edge rises
 * into a hump at the centre, where the hole's number sits between its arrows.
 */
const CARD_RISE = 24;
const CARD_PATH = (() => {
  const { w, h } = CARD;
  const c = w / 2;
  const r = CARD_RISE;
  return `M0 ${r + 14} Q0 ${r} 14 ${r} L${c - 66} ${r} C${c - 42} ${r} ${c - 38} 0 ${c} 0 C${c + 38} 0 ${c + 42} ${r} ${c + 66} ${r} L${w - 14} ${r} Q${w} ${r} ${w} ${r + 14} L${w} ${h - 14} Q${w} ${h} ${w - 14} ${h} L14 ${h} Q0 ${h} 0 ${h - 14} Z`;
})();
function cardPlace({ x, y, dx, dy, w, floor, top, bottom }: Spot): { side: "right" | "left" | "top" | "bottom"; gap: number; shift: number } {
  // Slides the card along its edge to keep it on screen (and clear of the dock), but never
  // so far that the connector misses it.
  const slide = (start: number, size: number, low: number, high: number) => {
    const most = size / 2 - 14;
    return Math.max(-most, Math.min(most, Math.max(low, Math.min(high - size, start)) - start));
  };
  const beside = () => slide(y - CARD.h / 2, CARD.h, 64, floor);
  const across = () => slide(x - CARD.w / 2, CARD.w, 8, w - 8);
  if (Math.abs(dy) >= Math.abs(dx)) {
    const gap = 18 + Math.min(70, (CARD.h / 2) * Math.abs(dx / dy));
    if (x + gap + CARD.w < w - 8) return { side: "right", gap, shift: beside() };
    if (x - gap - CARD.w > 8) return { side: "left", gap, shift: beside() };
  }
  // No room beside it (a phone): the card goes wholly below the hole, or above it, so it
  // never lies across the line of play; failing both, as near the middle as it fits.
  const clearance = 22;
  if (bottom + clearance + CARD.h < floor) return { side: "bottom", gap: bottom - y + clearance, shift: across() };
  if (top - clearance - CARD.h > 64) return { side: "top", gap: y - top + clearance, shift: across() };
  const gap = 18 + Math.min(70, (CARD.w / 2) * Math.abs(dy / (dx || 1)));
  const side = y - gap - CARD.h > 64 || y + gap + CARD.h > floor ? "top" : "bottom";
  return { side, gap, shift: across() };
}

/** Compass ticks every 6°, longer every 30°; the top one gives way to the N. */
const TICKS = Array.from({ length: 60 }, (_, i) => i * 6).filter((a) => a !== 0);

export function WindExplorer({
  data,
  events,
  places,
  center,
  initialHour,
  stay,
}: {
  data: WindData;
  events: WindEvent[];
  places: WindPlace[];
  center: [number, number];
  initialHour: number;
  /** The hours of check-in and check-out; -1 when outside the forecast */
  stay: [number, number];
}) {
  const hours = data.times.length;
  const [t, setT] = useState(Math.max(0, Math.min(hours - 1, initialHour)));
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [flowing, setFlowing] = useState(true);
  // Playback: steps through the chosen day's hours, the map's wind moving with them.
  const [running, setRunning] = useState(false);
  // The holes can be hidden to leave just the places; the choice is kept on this device.
  const [holesOn, setHolesOn] = useState(true);
  const holesOnRef = useRef(true);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(HOLES_KEY); } catch {}
    // Deferred a tick, like the other values only the browser knows.
    const apply = setTimeout(() => { if (saved === "off") setHolesOn(false); }, 0);
    return () => clearTimeout(apply);
  }, []);
  const flow = useRef(true);
  const [mapFailed, setMapFailed] = useState(false);
  useEffect(() => { flow.current = flowing; }, [flowing]);
  const [ready, setReady] = useState(false);
  const section = useRef<HTMLElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const live = useRef({ t: initialHour, dirty: true });
  const pins = useRef(new Map<string, HTMLElement>());
  // A point the user has touched on the map, and where it currently is on screen.
  // A hole tapped on the map carries the hole, and its reading says how the wind plays there.
  const [probe, setProbe] = useState<{ lng: number; lat: number; hole?: HoleRef } | null>(null);
  const [probeAt, setProbeAt] = useState<Spot | null>(null);
  const probeRef = useRef(probe);
  /** Where the dock begins, down the map. */
  const floor = () => {
    const box = section.current?.getBoundingClientRect();
    const top = dock.current?.getBoundingClientRect().top;
    return box && top ? top - box.top : (box?.height ?? 800) - 340;
  };
  useEffect(() => {
    probeRef.current = probe;
    const m = map.current;
    // Deferred a tick so the position is set after React has finished this update.
    const place = setTimeout(() => setProbeAt(probe && m ? spotOf(m, probe, floor()) : null), 0);
    return () => clearTimeout(place);
  }, [probe]);
  /** Frames a day's places (and the lodging) in the map left clear by the dock. */
  const frameDay = useRef<(day: number, animate: boolean) => void>(() => {});
  /** Room the map leaves for the dock and the corners when it frames or flies to places. */
  const padding = () => {
    const box = section.current?.getBoundingClientRect();
    const top = dock.current?.getBoundingClientRect().top;
    const phone = (box?.width ?? 0) < 768;
    const bottom = box && top ? Math.max(120, box.bottom - top + (phone ? 28 : 40)) : phone ? 380 : 340;
    // Labels turn to whichever side has room (see fitLabels), so the sides stay even.
    return phone ? { top: 100, bottom, left: 56, right: 56 } : { top: 150, bottom, left: 140, right: 160 };
  };

  // Where the player is at the chosen hour: at an event from its start until it is taken
  // to be over, and otherwise at their lodging, but only between check-in and check-out.
  const happening = events.filter((e) => e.start <= t && t < e.until).at(-1);
  const checkedIn = stay[0] >= 0 && t >= stay[0] && (stay[1] < 0 || t < stay[1]);
  // Copper marks only where the player is at the chosen hour. A pin someone clicks to
  // look at is flown to, but stays as it is.
  const groupPlace = happening ? happening.placeId : checkedIn ? (places.find((p) => p.home)?.id ?? null) : null;
  const dayOf = Math.max(0, Math.floor(t / 24));
  const dayEvents = useMemo(() => events.filter((e) => Math.floor(e.start / 24) === dayOf), [events, dayOf]);
  // The courses played that day (Shorty's too, though it is down as an outing), plus the
  // course of a hole someone has opened, have their holes drawn at any zoom.
  const shownCourses = [...new Set([...dayEvents.map((e) => courseFor(e.title)), probe?.hole?.course])].filter((c): c is string => !!c && !!HOLES[c]).join(",");
  const openHole = holeKey(probe?.hole);
  // Each of the day's pins names what is on there: the event happening at that place, or
  // its next one that day, or its first. Several things share a pin (Punchbowl and Pacific
  // Grill are both at the Pacific Dunes clubhouse). The lodging, with nothing on there,
  // carries no label until the player is there.
  const pinText = places
    .map((p) => {
      const there = dayEvents.filter((e) => e.placeId === p.id);
      const e = (happening?.placeId === p.id ? happening : undefined) ?? there.find((x) => x.until > t) ?? there[0];
      return [p.id, e ? e.title : p.home ? p.name : "", e ? clockAt(e.start) : "", e ? kindOf(e.type) : p.kind].join("\u0001");
    })
    .join("\u0002");
  const pinned = dayEvents.map((e) => e.placeId).filter(Boolean).join(",");
  const onMap = useRef(pinned);
  const active = useRef(groupPlace);
  const labels = useRef(pinText);
  const mark = () => {
    const text = new Map(labels.current.split("\u0002").map((row) => {
      const [id, title, time, kind] = row.split("\u0001");
      return [id, { title, time, kind: kind as keyof typeof ICONS }];
    }));
    pins.current.forEach((el, id) => {
      const on = id === active.current;
      const place = places.find((p) => p.id === id);
      const label = text.get(id);
      if (!place || !label) return;
      el.setAttribute("data-active", String(on));
      if (on) el.setAttribute("aria-current", "location");
      else el.removeAttribute("aria-current");
      el.style.display = place.home || onMap.current.split(",").includes(id) ? "" : "none";
      el.style.zIndex = on ? "2" : "1";
      // The lodging on its own is just its badge, unless the player is there.
      el.setAttribute("data-label", String(!!label.title && (!place.home || on || !!label.time)));
      el.querySelector(".wind-pin-time")!.textContent = label.time;
      el.querySelector(".wind-pin-name")!.textContent = label.title || place.name;
      el.querySelector("svg")!.innerHTML = ICONS[label.kind];
    });
    fitLabels();
  };
  /** Each label runs to its place's usual side, or to the other one where it would leave the screen. */
  const fitLabels = () => {
    const m = map.current;
    const width = mapBox.current?.clientWidth ?? 0;
    if (!m || !width) return;
    pins.current.forEach((el, id) => {
      const place = places.find((p) => p.id === id);
      const label = el.querySelector<HTMLElement>(".wind-pin-label");
      if (!place || !label || el.style.display === "none") return;
      const on = el.dataset.active === "true";
      // From the place to the label's far end: half the badge, then the label less the
      // part tucked under the badge.
      const reach = (on ? 22 : 14) + label.offsetWidth - (on ? 22 : 8);
      const { x } = m.project([place.lon, place.lat]);
      const fits = { right: x + reach <= width - 6, left: x - reach >= 6 };
      const other = place.side === "right" ? "left" : "right";
      el.dataset.side = fits[place.side] || !fits[other] ? place.side : other;
    });
  };
  useEffect(() => {
    active.current = groupPlace;
    onMap.current = pinned;
    labels.current = pinText;
    mark();
    // mark reads refs and the fixed list of places only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupPlace, pinned, pinText]);

  // Pins carry their labels in the day's overview. Zoomed in past it, or with a hole's
  // reading open, the labels fold away to the badges so the holes underneath can be read.
  const framedZoom = useRef(Infinity);
  const showLabels = useRef(() => {});

  // The holes layer is redrawn when the day's courses or the open hole change.
  const holesShown = useRef({ today: shownCourses.split(","), on: openHole });
  useEffect(() => {
    holesShown.current = { today: shownCourses.split(","), on: openHole };
    map.current?.getSource<GeoJSONSource>("holes")?.setData(holeFeatures(holesShown.current.today, openHole));
    showLabels.current();
  }, [shownCourses, openHole]);

  useEffect(() => {
    live.current.t = t;
    live.current.dirty = true;
  }, [t]);

  // ---- The map, the wind grid and the particle loop ----
  useEffect(() => {
    if (!mapBox.current || !canvas.current) return;
    const pinElements = pins.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // A day's view: every place with something on that day, and the lodging.
    const boundsOf = (day: number): [[number, number], [number, number]] => {
      const ids = new Set(events.filter((e) => Math.floor(e.start / 24) === day).map((e) => e.placeId));
      const shown = places.filter((p) => p.home || ids.has(p.id));
      // A day with a round takes in the whole course, not just its clubhouse.
      const holes = events
        .filter((e) => Math.floor(e.start / 24) === day && e.type === "golf")
        .flatMap((e) => HOLES[courseFor(e.title) ?? ""]?.holes.flatMap((h) => h.line) ?? []);
      if (!shown.length && !holes.length) return [[center[0] - 0.02, center[1] - 0.02], [center[0] + 0.02, center[1] + 0.02]];
      const lons = [...shown.map((p) => p.lon), ...holes.map((p) => p[0])];
      const lats = [...shown.map((p) => p.lat), ...holes.map((p) => p[1])];
      return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
    };
    const firstDay = Math.max(0, Math.floor(live.current.t / 24));
    frameDay.current = (day, animate) => {
      const options = { padding: padding(), maxZoom: 15 };
      framedZoom.current = m.cameraForBounds(boundsOf(day), options)?.zoom ?? framedZoom.current;
      m.stop().fitBounds(boundsOf(day), { ...options, duration: animate && !reduce.matches ? 750 : 0 });
    };
    showLabels.current = () => {
      const off = m.getZoom() > framedZoom.current + 0.35 || !!holesShown.current.on;
      section.current?.setAttribute("data-labels", off ? "off" : "on");
    };
    // The library's worker script is copied into public/ at build time (scripts/photos.mjs).
    setWorkerUrl("/maplibre-worker.mjs");
    let m: MapLibre;
    try { m = new MapLibre({
      container: mapBox.current,
      style: aerialStyle(),
      bounds: boundsOf(firstDay),
      fitBoundsOptions: { padding: padding(), maxZoom: 15 },
      minZoom: 9.6,
      maxZoom: 19.5,
      maxBounds: [
        [center[0] - 0.75, center[1] - 0.5],
        [center[0] + 0.75, center[1] + 0.5],
      ],
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    });
    } catch {
      setTimeout(() => setMapFailed(true), 0);
      return;
    }
    framedZoom.current = m.getZoom();
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    map.current = m;

    for (const p of places) {
      // A badge with the place's icon, and a label with what is on there. Whichever place
      // the group is at for the chosen hour is marked data-active and turns copper. The
      // element itself has no size: it sits on the place, and its badge is centred there.
      const el = document.createElement("button");
      el.type = "button";
      el.className = "wind-pin";
      el.dataset.side = p.side;
      el.setAttribute("aria-label", `Zoom to ${p.name}`);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        // The pin names the place already, so no reading box opens over it.
        setSelectedPlace(p.id);
        setProbe(null);
        m.stop().flyTo({ center: [p.lon, p.lat], zoom: 15.6, padding: padding(), duration: reduce.matches ? 0 : 850 });
      });
      el.innerHTML = `<span class="wind-pin-body"><span class="wind-pin-badge"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${
        ICONS[p.kind]
      }</svg></span><span class="wind-pin-label"><span class="wind-pin-time"></span><span class="wind-pin-name"></span></span></span>`;
      new Marker({ element: el, anchor: "center" }).setLngLat([p.lon, p.lat]).addTo(m);
      pins.current.set(p.id, el);
    }
    mark();

    let particles: WindParticles;
    try { particles = new WindParticles(canvas.current); }
    catch { m.remove(); map.current = null; setTimeout(() => setMapFailed(true), 0); return; }
    const { lats, lons, u, v } = data.grid;
    const rows = lats.length;
    const cols = lons.length;
    // Where each on-screen grid cell falls in the data grid (fractional column and row),
    // refreshed when the map moves; and the wind there, refreshed when the hour changes.
    let gw = 0;
    let gh = 0;
    let cellCol = new Float32Array(0);
    let cellRow = new Float32Array(0);
    let windX = new Float32Array(0);
    let windY = new Float32Array(0);

    const locate = () => {
      // The map can report a move or resize just after the page has been left.
      const box = mapBox.current;
      if (!box) return;
      gw = Math.ceil(box.clientWidth / CELL) + 2;
      gh = Math.ceil(box.clientHeight / CELL) + 2;
      cellCol = new Float32Array(gw * gh);
      cellRow = new Float32Array(gw * gh);
      windX = new Float32Array(gw * gh);
      windY = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const ll = m.unproject([i * CELL, j * CELL]);
          const c = ((ll.lng - lons[0]) / (lons[cols - 1] - lons[0])) * (cols - 1);
          const r = ((ll.lat - lats[0]) / (lats[rows - 1] - lats[0])) * (rows - 1);
          cellCol[j * gw + i] = Math.min(cols - 1.001, Math.max(0, c));
          cellRow[j * gw + i] = Math.min(rows - 1.001, Math.max(0, r));
        }
      }
      live.current.dirty = true;
    };

    const blow = () => {
      const time = Math.min(hours - 1, Math.max(0, live.current.t));
      const h0 = Math.floor(time);
      const h1 = Math.min(hours - 1, h0 + 1);
      const f = time - h0;
      const at = (field: number[][], k: number) => field[h0][k] + (field[h1][k] - field[h0][k]) * f;
      for (let n = 0; n < gw * gh; n++) {
        const c0 = Math.floor(cellCol[n]);
        const r0 = Math.floor(cellRow[n]);
        const fc = cellCol[n] - c0;
        const fr = cellRow[n] - r0;
        const k = r0 * cols + c0;
        const mix = (field: number[][]) =>
          (at(field, k) * (1 - fc) + at(field, k + 1) * fc) * (1 - fr) +
          (at(field, k + cols) * (1 - fc) + at(field, k + cols + 1) * fc) * fr;
        windX[n] = mix(u);
        windY[n] = -mix(v); // north is up the screen
      }
      live.current.dirty = false;
    };

    particles.setSampler((x, y) => {
      const i = Math.floor(x / CELL);
      const j = Math.floor(y / CELL);
      if (i < 0 || j < 0 || i >= gw - 1 || j >= gh - 1) return null;
      const fx = x / CELL - i;
      const fy = y / CELL - j;
      const n = j * gw + i;
      const lerp = (a: Float32Array) =>
        (a[n] * (1 - fx) + a[n + 1] * fx) * (1 - fy) + (a[n + gw] * (1 - fx) + a[n + gw + 1] * fx) * fy;
      return [lerp(windX), lerp(windY)];
    });

    const size = () => {
      if (!mapBox.current) return;
      particles.resize(mapBox.current.clientWidth, mapBox.current.clientHeight);
      locate();
    };

    let moving = false;
    let frames = 0;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Ambient animation: 30 frames a second is plenty, and nothing while hidden or panning.
      if (now - last < 33 || moving || document.hidden) return;
      last = now;
      if (live.current.dirty) {
        blow();
        frames = 0;
      }
      // With reduced motion, draw the streaks for a moment and then hold them still.
      if ((reduce.matches || !flow.current) && frames > 20) return;
      frames++;
      particles.frame();
    };

    // Touch the map anywhere for the wind at that spot. The reading follows the map.
    // A hole under the touch (one that is showing) opens that hole's reading instead.
    const holeAt = (x: number, y: number): HoleRef | null => {
      if (!holesOnRef.current || !m.getLayer("holes-number")) return null;
      const far = m.getZoom() >= HOLES_FROM_ZOOM + 0.3;
      const hit = m
        .queryRenderedFeatures([[x - 10, y - 10], [x + 10, y + 10]], { layers: ["holes-number-on", "holes-number", "holes-line", "holes-green"] })
        .find((f) => far || f.properties.today || f.properties.on);
      return hit ? { course: String(hit.properties.course), n: Number(hit.properties.n) } : null;
    };
    m.on("click", (e) => {
      setSelectedPlace(null);
      const hole = holeAt(e.point.x, e.point.y);
      const middle = hole && holeMiddle(hole);
      setProbe(hole && middle ? { lng: middle[0], lat: middle[1], hole } : { lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    m.on("mousemove", (e) => {
      m.getCanvas().style.cursor = holeAt(e.point.x, e.point.y) ? "pointer" : "";
    });
    m.on("move", () => {
      const p = probeRef.current;
      if (p) setProbeAt(spotOf(m, p, floor()));
    });
    m.on("movestart", () => {
      moving = true;
      particles.clear();
    });
    m.on("zoom", () => showLabels.current());
    m.on("moveend", () => {
      moving = false;
      locate();
      fitLabels();
    });
    m.on("load", async () => {
      size();
      setReady(true);
      raf = requestAnimationFrame(tick);
      // The holes, under the wind. Badges are drawn once the page's typeface has loaded.
      await document.fonts.ready;
      if (map.current !== m) return;
      const font = getComputedStyle(mapBox.current ?? document.body).fontFamily;
      for (let n = 1; n <= 19; n++) {
        m.addImage(`hole-${n}`, holeBadge(n, false, font), { pixelRatio: 2 });
        m.addImage(`hole-on-${n}`, holeBadge(n, true, font), { pixelRatio: 2 });
      }
      m.addSource("holes", { type: "geojson", data: holeFeatures(holesShown.current.today, holesShown.current.on) });
      // The open hole's outline: its fairway, tees and green as one shape, washed faintly in
      // amber and edged in copper, with the ground showing through.
      m.addLayer({
        id: "holes-outline-fill", type: "fill", source: "holes", filter: ["==", ["get", "part"], "outline"],
        paint: { "fill-color": "#d99a6c", "fill-opacity": 0.16 },
      });
      m.addLayer({
        id: "holes-outline", type: "line", source: "holes", filter: ["==", ["get", "part"], "outline"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#e7a77a",
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 17, 2],
          "line-opacity": 0.9,
        },
      });
      m.addLayer({
        id: "holes-green", type: "fill", source: "holes", filter: ["==", ["get", "part"], "green"],
        paint: {
          "fill-color": ["case", ["get", "on"], "#e7a77a", "#eceee8"],
          "fill-opacity": holeOpacity({ on: 0.34, near: 0.24, far: 0.14, dim: 0.08 }),
        },
      });
      m.addLayer({
        id: "holes-line", type: "line", source: "holes", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "on"], "#d99a6c", "#eceee8"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, ["case", ["get", "on"], 2.5, 1.2], 17, ["case", ["get", "on"], 4, 2]],
          "line-opacity": holeOpacity({ on: 1, near: 0.8, far: 0.5, dim: 0.3 }),
        },
      });
      m.addLayer({
        id: "holes-number", type: "symbol", source: "holes", filter: ["all", ["==", ["geometry-type"], "Point"], ["!", ["get", "on"]]],
        layout: {
          "icon-image": ["concat", "hole-", ["to-string", ["get", "n"]]],
          // Today's courses win when badges crowd each other.
          "symbol-sort-key": ["case", ["get", "today"], 1, 2],
          "icon-padding": 1,
        },
        paint: { "icon-opacity": holeOpacity({ on: 1, near: 1, far: 0.85, dim: 0.5 }) },
      });
      // The open hole's badge always shows, over its neighbours if it must.
      m.addLayer({
        id: "holes-number-on", type: "symbol", source: "holes", filter: ["all", ["==", ["geometry-type"], "Point"], ["get", "on"]],
        layout: { "icon-image": ["concat", "hole-on-", ["to-string", ["get", "n"]]], "icon-allow-overlap": true, "icon-ignore-placement": true },
      });
      if (!holesOnRef.current) for (const id of HOLE_LAYERS) m.setLayoutProperty(id, "visibility", "none");
    });
    const observer = new ResizeObserver(() => {
      m.resize();
      size();
    });
    observer.observe(mapBox.current);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      particles.destroy();
      m.remove();
      map.current = null;
      pinElements.clear();
    };
    // The map is built once; later changes reach it through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Showing or hiding the holes.
  useEffect(() => {
    holesOnRef.current = holesOn;
    const m = map.current;
    if (m?.getLayer("holes-number")) for (const id of HOLE_LAYERS) m.setLayoutProperty(id, "visibility", holesOn ? "visible" : "none");
  }, [holesOn]);

  // A new day brings that day's places into view.
  const framedDay = useRef(dayOf);
  useEffect(() => {
    if (framedDay.current === dayOf) return;
    framedDay.current = dayOf;
    frameDay.current(dayOf, true);
  }, [dayOf]);

  // ---- The dock's outline, drawn for its size ----
  const [dockSize, setDockSize] = useState({ w: 370, h: 276 });
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setDockSize({ w: el.offsetWidth, h: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const outline = dockPath(dockSize.w, dockSize.h);

  // ---- What the dock says for the chosen hour ----
  // The wind at the touched point for the chosen hour, read from the same field the
  // particles follow.
  const reading = useMemo(() => {
    if (!probe) return null;
    const { lats, lons, u, v } = data.grid;
    const rows = lats.length;
    const cols = lons.length;
    const time = Math.min(hours - 1, Math.max(0, t));
    const h0 = Math.floor(time);
    const h1 = Math.min(hours - 1, h0 + 1);
    const f = time - h0;
    const c = Math.min(cols - 1.001, Math.max(0, ((probe.lng - lons[0]) / (lons[cols - 1] - lons[0])) * (cols - 1)));
    const r = Math.min(rows - 1.001, Math.max(0, ((probe.lat - lats[0]) / (lats[rows - 1] - lats[0])) * (rows - 1)));
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const k = r0 * cols + c0;
    const at = (field: number[][], i: number) => field[h0][i] + (field[h1][i] - field[h0][i]) * f;
    const mix = (field: number[][]) =>
      (at(field, k) * (1 - (c - c0)) + at(field, k + 1) * (c - c0)) * (1 - (r - r0)) +
      (at(field, k + cols) * (1 - (c - c0)) + at(field, k + cols + 1) * (c - c0)) * (r - r0);
    const east = mix(u);
    const north = mix(v);
    return {
      mph: Math.round(Math.hypot(east, north)),
      // Degrees the wind blows from
      from: (Math.atan2(-east, -north) * 180) / Math.PI,
    };
  }, [probe, t, data, hours]);

  const local = timelineLocal(data.times, t);
  const date = local.slice(0, 10);
  const day = data.days.find((d) => d.date === date);
  const minuteNow = Math.round(t * 60);
  const sunrise = day ? minutesFromStart(data.times, day.sunrise) : -1;
  const sunset = day ? minutesFromStart(data.times, day.sunset) : -1;
  const dark = day && sunrise >= 0 ? minuteNow < sunrise || minuteNow >= sunset : false;
  const daylight = !day || sunrise < 0
    ? null
    : dark
      ? minuteNow < sunrise ? `Sunrise ${clockAt(sunrise / 60)}` : "After dark"
      : sunset - minuteNow <= 90
        ? `${sunset - minuteNow} min left`
        : `Sunset ${clockAt(sunset / 60)}`;
  const { speed, gust, direction, temp, rainChance, code } = data.point;
  const hourNow = Math.min(hours - 1, Math.floor(t));
  const windSpeed = Math.round(interpolate(speed, t));
  const windGust = Math.round(interpolate(gust, t));
  const windDirection = interpolateDirection(direction, t);
  const temperature = Math.round(interpolate(temp, t));
  const chance = rainChance[hourNow];
  const sky = describe(code[hourNow] ?? 3);
  const dates = useMemo(() => [...new Set(data.times.map((x) => x.slice(0, 10)))], [data]);

  // The compass needle turns the short way round: 350° to 10° is 20° clockwise, not 340°
  // back. It keeps a running angle and adds each change to it.
  const [needle, setNeedle] = useState(windDirection);
  const turn = ((((windDirection - needle) % 360) + 540) % 360) - 180;
  if (Math.abs(turn) > 0.01) setNeedle(needle + turn);

  // The day's hours, each with its wind, and a badge where something starts.
  const strand = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, k) => {
    const h = FIRST_HOUR + k;
    const at = dayOf * 24 + h;
    if (at >= hours) return null;
    const stop = dayEvents.find((e) => Math.floor(e.start) === at);
    return {
      h,
      at,
      on: at === hourNow,
      night: sunrise >= 0 && ((h + 1) * 60 <= sunrise - dayOf * 1440 || h * 60 >= sunset - dayOf * 1440),
      speed: speed[at],
      from: direction[at],
      stop,
    };
  }).filter((x) => x !== null);

  // Keep the chosen hour in the middle of the strip, where there is more than fits.
  const centred = useRef(false);
  useEffect(() => {
    const box = strip.current;
    const cell = box?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!box || !cell) return;
    const smooth = centred.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: cell.offsetLeft + cell.offsetWidth / 2 - box.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
    centred.current = true;
  }, [hourNow]);

  const go = (time: number) => {
    setRunning(false);
    setSelectedPlace(null);
    // An open hole stays open through the day's hours, so its wind can be followed.
    setProbe((p) => (p?.hole && Math.floor(time / 24) === dayOf ? p : null));
    setT(Math.max(0, Math.min(hours - 1, time)));
  };
  const chooseDay = (i: number) => {
    // A day opens on its first event, or mid-morning; the day already open is re-framed.
    const first = events.find((e) => Math.floor(e.start / 24) === i);
    go(first ? first.start : i * 24 + 10);
    if (i === dayOf) frameDay.current(i, true);
  };
  // The day's last hour in the strip, where playback stops.
  const dayEnd = Math.min(hours - 1, dayOf * 24 + LAST_HOUR);
  useEffect(() => {
    if (!running) return;
    // An hour every two and a half seconds, in small steps so the wind moves smoothly.
    const timer = setInterval(() => {
      if (document.hidden) return;
      setT((now) => Math.min(dayEnd, now + 1 / 40));
    }, 62);
    return () => clearInterval(timer);
  }, [running, dayEnd]);
  useEffect(() => {
    if (!running || t < dayEnd) return;
    const stop = setTimeout(() => setRunning(false), 0);
    return () => clearTimeout(stop);
  }, [running, t, dayEnd]);
  const toggleHoles = () => {
    const next = !holesOn;
    setHolesOn(next);
    // Hiding the holes closes an open one.
    if (!next) setProbe((p) => (p?.hole ? null : p));
    try { window.localStorage.setItem(HOLES_KEY, next ? "on" : "off"); } catch {}
  };
  const play = () => {
    if (running) return setRunning(false);
    setSelectedPlace(null);
    // From the start of the day when the day is already played through.
    if (t >= dayEnd) setT(Math.min(hours - 1, dayOf * 24 + FIRST_HOUR));
    setRunning(true);
  };
  const dayShare = Math.max(0, Math.min(1, (t - (dayOf * 24 + FIRST_HOUR)) / (LAST_HOUR - FIRST_HOUR)));

  /** Opens a hole and brings it into view, between the top of the map and the dock. */
  const showHole = (target: HoleRef) => {
    const hole = HOLES[target.course]?.holes.find((h) => h.n === target.n);
    const middle = holeMiddle(target);
    if (!hole || !middle) return;
    setSelectedPlace(null);
    setProbe({ lng: middle[0], lat: middle[1], hole: target });
    const pts = [...hole.line, ...(hole.green ?? [])];
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const room = padding();
    // A phone has no room beside the hole for its card, so it is left room underneath.
    const phone = (section.current?.clientWidth ?? 0) < 768;
    map.current?.stop().fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
      padding: phone ? { ...room, bottom: room.bottom + CARD.h + 30 } : room,
      maxZoom: 17,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    });
  };
  /** The hole before or after the open one on its course, round from the last to the first. */
  const neighbour = (by: number): HoleRef | null => {
    const open = probe?.hole;
    const holes = open ? HOLES[open.course]?.holes : null;
    if (!open || !holes?.length) return null;
    const i = holes.findIndex((h) => h.n === open.n);
    return { course: open.course, n: holes[(i + by + holes.length) % holes.length].n };
  };
  const step = (by: number) => {
    const next = neighbour(by);
    if (next) showHole(next);
  };
  // With a hole open, the arrow keys step through the course too. They are caught before
  // the map's own keyboard panning sees them.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });
  useEffect(() => {
    if (!openHole) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        stepRef.current(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openHole]);

  const zoom = (by: number) => {
    const m = map.current;
    if (m) m.stop().easeTo({ zoom: m.getZoom() + by, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220 });
  };
  const reset = () => { setProbe(null); setSelectedPlace(null); frameDay.current(dayOf, true); };
  const icon = (path: string, size = 18) => <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;

  return (
    <section ref={section} aria-label="Wind map" className="wind-instrument" data-labels="on">
      <div className="absolute inset-0"><div ref={mapBox} className="h-full w-full" /></div>
      <canvas ref={canvas} aria-hidden="true" className={`wind-canvas ${ready ? "is-ready" : ""}`} />
      <div className="wind-map-shade" aria-hidden="true" />
      {!ready && <p className="wind-map-status" role="status">{mapFailed ? "Map unavailable. The forecast is still in the panel below." : "Loading resort imagery…"}</p>}

      <div className="wind-map-tools" role="group" aria-label="Map controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1)}>{icon("M9 3v12M3 9h12", 16)}</button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoom(-1)}>{icon("M3 9h12", 16)}</button>
        <button type="button" title="Back to the day's places" aria-label="Back to the day's places" onClick={reset}>{icon("M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4", 16)}</button>
        <button type="button" title={flowing ? "Freeze wind particles" : "Animate wind particles"} aria-label={flowing ? "Freeze wind particles" : "Animate wind particles"} aria-pressed={flowing} onClick={() => setFlowing(!flowing)}>{icon("M2 6h9a2 2 0 1 0-2-2M2 10h12a2 2 0 1 1-2 2M2 14h4", 16)}</button>
      </div>

      <div className="wind-key" aria-label="Map key">
        <span className="wind-speed-key"><span>0</span><i style={{background: `linear-gradient(to right, ${SPEED_STOPS.map(([sp,c]) => `rgb(${c.join(" ")}) ${sp / 35 * 100}%`).join(",")})`}} /><span>35+ mph</span></span>
        <span className="wind-attribution">Imagery USDA NAIP / USGS · Wind <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Places © OpenStreetMap</span>
      </div>

      {probe && probeAt && !probe.hole && reading && <div className="wind-probe" style={{left: probeAt.x, top: probeAt.y}}>
        <span className="wind-probe-dot" />
        <div><span className="wind-probe-label">{places.find(p => p.id === selectedPlace)?.name ?? "At this point"}</span><p><strong>{reading.mph} mph</strong> from {compass(reading.from)}</p></div>
        <button type="button" aria-label="Close the reading" onClick={() => setProbe(null)}>{icon("M5 5l8 8M13 5l-8 8")}</button>
      </div>}

      {/* An open hole's card: how the wind plays there first, the hole second. It reads the
          same forecast as the dock, so the two always agree, and sits beside the line of play
          with a connector back to it. */}
      {probe?.hole && probeAt && (() => {
        const course = HOLES[probe.hole.course];
        const hole = course?.holes.find((h) => h.n === probe.hole!.n);
        if (!course || !hole) return null;
        const { along, across } = windOnHole(hole.line, windDirection);
        const { side, gap, shift } = cardPlace(probeAt);
        return (
          <div className={`wind-hole-tip is-${side}`} style={{ left: probeAt.x, top: probeAt.y, "--gap": `${gap}px`, "--shift": `${shift}px` } as React.CSSProperties}>
            <span className="wind-hole-tip-dot" aria-hidden="true" />
            <span className="wind-hole-tip-line" aria-hidden="true" />
            <div className="wind-hole-tip-card">
              <div className="wind-hole-tip-glass" style={{ clipPath: `path('${CARD_PATH}')` }} aria-hidden="true" />
              <svg className="wind-hole-tip-edge" width={CARD.w} height={CARD.h} aria-hidden="true">
                <defs>
                  <mask id="wind-hole-tip-outside" maskUnits="userSpaceOnUse" x="-6" y="-6" width={CARD.w + 12} height={CARD.h + 12}>
                    <rect x="-6" y="-6" width={CARD.w + 12} height={CARD.h + 12} fill="#fff" />
                    <path d={CARD_PATH} fill="#000" />
                  </mask>
                </defs>
                <path d={CARD_PATH} fill="none" stroke="rgb(4 14 11 / .45)" strokeWidth="3" mask="url(#wind-hole-tip-outside)" />
                <path d={CARD_PATH} fill="none" stroke="rgb(233 231 224 / .22)" />
              </svg>
              {/* The hump: the hole's number, with the holes either side of it to step to. */}
              <button type="button" className="wind-hole-tip-step is-back" aria-label={`Previous hole, ${neighbour(-1)?.n}`} onClick={() => step(-1)}>{icon("M11 4L6 9l5 5", 15)}</button>
              <span className="wind-hole-tip-number" aria-hidden="true">{hole.n}</span>
              <button type="button" className="wind-hole-tip-step is-on" aria-label={`Next hole, ${neighbour(1)?.n}`} onClick={() => step(1)}>{icon("M7 4l5 5-5 5", 15)}</button>
              <button type="button" className="wind-hole-tip-close" aria-label={`Close hole ${hole.n}`} onClick={() => setProbe(null)}>{icon("M5 5l8 8M13 5l-8 8", 13)}</button>
              <div className="wind-hole-tip-text" role="status">
                <p className="wind-hole-tip-name"><span className="sr-only">Hole {hole.n}, </span>{course.name}{hole.par ? ` · Par ${hole.par}` : ""} · <Link href={`/holes?course=${probe.hole.course}&hole=${hole.n}`}>Hole view<span className="sr-only"> of hole {hole.n}</span></Link></p>
                <p className="wind-hole-tip-wind"><strong>{windSpeed} mph</strong> <em>{along ?? "crosswind"}</em>{across && ` · ${across}`}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Playback, floating over the map just above the dock's left shoulder. Its ring fills
          as the day plays through. */}
      <button type="button" className={`wind-play ${running ? "is-running" : ""}`} onClick={play}
        aria-label={running ? "Pause" : "Play the day hour by hour"} aria-pressed={running}>
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
          <circle cx="23" cy="23" r="21" fill="none" stroke="rgb(233 231 224 / .16)" strokeWidth="2" />
          <circle className="wind-play-ring" cx="23" cy="23" r="21" fill="none" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={`${(dayShare * 2 * Math.PI * 21).toFixed(1)} ${(2 * Math.PI * 21).toFixed(1)}`} transform="rotate(-90 23 23)" />
          {running ? <path d="M18 16v14M28 16v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /> : <path d="M19 15.5v15l12-7.5z" fill="currentColor" />}
        </svg>
      </button>

      {/* The holes, shown or hidden, on the dock's right shoulder: play's opposite number. */}
      <button type="button" className={`wind-holes-toggle ${holesOn ? "is-on" : ""}`} onClick={toggleHoles}
        aria-label={holesOn ? "Hide holes" : "Show holes"} title={holesOn ? "Hide holes" : "Show holes"} aria-pressed={holesOn}>
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
          <circle cx="23" cy="23" r="21" fill="none" stroke="rgb(233 231 224 / .16)" strokeWidth="2" />
          <circle className="wind-holes-ring" cx="23" cy="23" r="21" fill="none" strokeWidth="2" />
          <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 29V14l8 3.2-8 3.2" />
            <path d="M16 29.5c2-.9 4.4-1.3 7-1.3s5 .4 7 1.3" />
          </g>
        </svg>
      </button>

      {/* The dock: the wind for the chosen hour around a compass, the days, and the hours.
          Its outline is clipped glass with a crisp edge; nothing is blurred outside it. */}
      <div ref={dock} className="wind-dock" role="region" aria-label="Forecast">
        <div className="wind-dock-glass" style={{ clipPath: `path('${outline}')` }} aria-hidden="true" />
        <svg className="wind-dock-edge" width={dockSize.w} height={dockSize.h} aria-hidden="true">
          <defs>
            <mask id="wind-dock-outside" maskUnits="userSpaceOnUse" x="-8" y="-8" width={dockSize.w + 16} height={dockSize.h + 16}>
              <rect x="-8" y="-8" width={dockSize.w + 16} height={dockSize.h + 16} fill="#fff" />
              <path d={outline} fill="#000" />
            </mask>
          </defs>
          {/* A dark keyline just outside the edge separates the panel from bright ground. */}
          <path d={outline} fill="none" stroke="rgb(4 14 11 / .45)" strokeWidth="3" mask="url(#wind-dock-outside)" />
          <path d={outline} fill="none" stroke="rgb(233 231 224 / .22)" />
        </svg>

        <div className="wind-dock-reading">
          {/* Each stat has a short name for phones and, where it says more, a long one for
              wider screens: the time's long name is the daylight ("Sunset 4:49 PM"). */}
          <div className="wind-dock-side">
            <div className="wind-stat">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
              <div>
                <p className={`wind-stat-name ${dark ? "is-dark" : ""}`}><span className="is-short">Time</span><span className="is-long">{daylight ?? "Time"}</span></p>
                <p className="wind-stat-value is-time">{clockAt(t)}</p>
              </div>
            </div>
            <div className="wind-stat"><WindGlyph size={24} /><div><p className="wind-stat-name">Gusts</p><p className="wind-stat-value">{windGust} mph</p></div></div>
          </div>

          <div className="wind-dock-compass" role="img" aria-label={`${windSpeed} mph from the ${compass(windDirection)}`}>
            <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
              <circle cx="56" cy="56" r="53" fill="rgb(10 26 21 / .55)" stroke="rgb(233 231 224 / .28)" />
              {TICKS.map((a) => (
                <line key={a} x1="56" y1={a % 30 === 0 ? 14 : 11} x2="56" y2="8" stroke="#e9e7e0" strokeOpacity={a % 30 === 0 ? 0.6 : 0.25} strokeWidth={a % 30 === 0 ? 1.4 : 1} transform={`rotate(${a} 56 56)`} />
              ))}
              {/* The big mark sits on the side the wind comes from; the small one, where it goes. */}
              <g className="wind-dock-needle" style={{ transform: `rotate(${needle}deg)` }}>
                <path d="M47.5 2.5 L64.5 2.5 L56 18 Z" fill="#d99a6c" />
                <path d="M50.5 98 L61.5 98 L56 108 Z" fill="#d99a6c" fillOpacity=".85" />
              </g>
              {/* The N sits in the ring, over the mark when the wind is from the north. */}
              <text x="56" y="15.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#eceee8">N</text>
            </svg>
            <div className="wind-dock-speed" aria-hidden="true">
              <span>mph</span>
              <strong>{windSpeed}</strong>
              <b>{compass(windDirection)}</b>
            </div>
          </div>

          <div className="wind-dock-side">
            <div className="wind-stat"><WeatherGlyph kind={sky.kind} size={22} /><div><p className="wind-stat-name"><span className="is-short">Temp</span><span className="is-long">{sky.label}</span></p><p className="wind-stat-value">{temperature}°F</p></div></div>
            <div className="wind-stat"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2c2.4 2.9 3.8 5 3.8 6.9a3.8 3.8 0 0 1-7.6 0C4.2 7.2 5.6 5.1 8 2.2Z" /></svg><div><p className="wind-stat-name">Rain</p><p className="wind-stat-value">{chance === null ? "n/a" : `${chance}%`}</p></div></div>
          </div>
        </div>

        <div className="wind-dock-days" role="group" aria-label="Forecast day" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
          {dates.map((d, i) => (
            <button key={d} type="button" aria-pressed={i === dayOf} onClick={() => chooseDay(i)}>
              {weekday(d)}<span>{Number(d.slice(8))}</span>
            </button>
          ))}
        </div>

        <div ref={strip} className="wind-dock-hours" role="group" aria-label="Hour">
          <div>
            {strand.map((x) => (
              <button key={x.at} type="button" aria-pressed={x.on} className={x.night ? "is-night" : ""}
                aria-label={`${hourName(x.h)}: ${x.speed} mph from the ${compass(x.from)}${x.stop ? `. ${x.stop.title} at ${clockAt(x.stop.start)}` : ""}`}
                onClick={() => go(x.stop ? x.stop.start : x.at)}>
                {x.stop && (
                  <span className={`wind-hour-stop ${happening?.id === x.stop.id ? "is-on" : ""}`} aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[kindOf(x.stop.type)] }} />
                  </span>
                )}
                <span className="wind-hour-name">{hourName(x.h)}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${x.from + 180}deg)` }}><path d="M12 3L18 19L12 15.5L6 19Z" fill="currentColor" /></svg>
                <span className="wind-hour-speed">{x.speed}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
