"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre, Marker, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WindData } from "@/lib/wind";
import coast from "@/lib/coast.json";
import { describe } from "@/lib/weatherCodes";
import { compass, interpolate, interpolateDirection, timelineLocal, minutesFromStart, SPEED_STOPS } from "@/lib/windMath";
import { WeatherGlyph, WindGlyph } from "../Glyphs";
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

/** The shoreline as [latitude, longitude], south to north (scripts/trace-coast.mjs) */
const COAST = coast as [number, number][];

// The aerial tiles we host cover these z15 tiles (see scripts/build-tiles.mjs).
const Z15 = { x0: 5059, x1: 5063, y0: 12012, y1: 12019 };
const lonOf = (x: number) => (x / 2 ** 15) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** 15))) * 180) / Math.PI;
const NAIP_BOUNDS: [number, number, number, number] = [lonOf(Z15.x0), latOf(Z15.y1 + 1), lonOf(Z15.x1 + 1), latOf(Z15.y0)];

// Our aerial tiles are darker and flatter than the wide-area imagery around them (about
// 0.62 of its brightness, measured on matching tiles), so each is set to meet the other.
// Both are dimmed a little, so the wind and the dark panels read over the ground.
const NAIP_PAINT = { "raster-brightness-max": 0.72, "raster-saturation": 0.04, "raster-contrast": 0.04, "raster-fade-duration": 200 };
const WIDE_PAINT = { "raster-brightness-max": 0.46, "raster-saturation": -0.05, "raster-fade-duration": 200 };

/** Deep Pacific: the open sea past the imagery, and the ground under the map. */
const OCEAN: [number, number, number] = [18, 46, 54];
const OCEAN_HEX = `#${OCEAN.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/**
 * A picture of "open ocean": transparent over land and the surf, fading to the map's
 * background colour a little way offshore. Laid over the imagery, it hides the ragged
 * line out at sea where the aerial coverage stops.
 */
const SEA = { west: -125.3, east: -124.0, south: COAST[0][0], north: COAST[COAST.length - 1][0] };
function seaFade(): string {
  const size = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const top = mercY(SEA.north);
  const bottom = mercY(SEA.south);
  for (let y = 0; y < size; y++) {
    // Rows are evenly spaced on the map, not in latitude.
    const lat = (Math.atan(Math.exp(top + ((bottom - top) * y) / (size - 1))) * 360) / Math.PI - 90;
    const at = Math.min(COAST.length - 2, Math.max(0, Math.floor((lat - SEA.south) / (COAST[1][0] - COAST[0][0]))));
    const f = (lat - COAST[at][0]) / (COAST[at + 1][0] - COAST[at][0]);
    const shore = COAST[at][1] + (COAST[at + 1][1] - COAST[at][1]) * f;
    for (let x = 0; x < size; x++) {
      const lon = SEA.west + ((SEA.east - SEA.west) * x) / (size - 1);
      // Clear until ~500 m off the shore, solid by ~1.4 km.
      const t = Math.min(1, Math.max(0, (shore - 0.006 - lon) / 0.011));
      const i = (y * size + x) * 4;
      img.data[i] = OCEAN[0];
      img.data[i + 1] = OCEAN[1];
      img.data[i + 2] = OCEAN[2];
      img.data[i + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}
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
  const [probe, setProbe] = useState<{ lng: number; lat: number } | null>(null);
  const [probeAt, setProbeAt] = useState<{ x: number; y: number } | null>(null);
  const probeRef = useRef(probe);
  useEffect(() => {
    probeRef.current = probe;
    const m = map.current;
    // Deferred a tick so the position is set after React has finished this update.
    const place = setTimeout(() => setProbeAt(probe && m ? m.project([probe.lng, probe.lat]) : null), 0);
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
      if (!shown.length) return [[center[0] - 0.02, center[1] - 0.02], [center[0] + 0.02, center[1] + 0.02]];
      const lons = shown.map((p) => p.lon);
      const lats = shown.map((p) => p.lat);
      return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
    };
    const firstDay = Math.max(0, Math.floor(live.current.t / 24));
    frameDay.current = (day, animate) => {
      m.stop().fitBounds(boundsOf(day), { padding: padding(), maxZoom: 15, duration: animate && !reduce.matches ? 750 : 0 });
    };
    // The library's worker script is copied into public/ at build time (scripts/photos.mjs).
    setWorkerUrl("/maplibre-worker.mjs");
    let m: MapLibre;
    try { m = new MapLibre({
      container: mapBox.current,
      style: {
        version: 8,
        sources: {
          wide: {
            type: "raster",
            tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 16,
          },
          sea: {
            type: "image",
            url: seaFade(),
            coordinates: [
              [SEA.west, SEA.north],
              [SEA.east, SEA.north],
              [SEA.east, SEA.south],
              [SEA.west, SEA.south],
            ],
          },
          naip: {
            type: "raster",
            tiles: [`${window.location.origin}/tiles/naip/{z}/{x}/{y}.webp`],
            tileSize: 256,
            minzoom: 12,
            maxzoom: 18,
            bounds: NAIP_BOUNDS,
          },
        },
        layers: [
          { id: "ground", type: "background", paint: { "background-color": OCEAN_HEX } },
          { id: "wide", type: "raster", source: "wide", paint: WIDE_PAINT },
          { id: "naip", type: "raster", source: "naip", paint: NAIP_PAINT },
          { id: "sea", type: "raster", source: "sea", paint: { "raster-fade-duration": 0 } },
        ],
      },
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
    m.on("click", (e) => {
      setSelectedPlace(null);
      setProbe({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    m.on("move", () => {
      const p = probeRef.current;
      if (p) setProbeAt(m.project([p.lng, p.lat]));
    });
    m.on("movestart", () => {
      moving = true;
      particles.clear();
    });
    m.on("moveend", () => {
      moving = false;
      locate();
      fitLabels();
    });
    m.on("load", () => {
      size();
      setReady(true);
      raf = requestAnimationFrame(tick);
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
    setSelectedPlace(null);
    setProbe(null);
    setT(Math.max(0, Math.min(hours - 1, time)));
  };
  const chooseDay = (i: number) => {
    // A day opens on its first event, or mid-morning; the day already open is re-framed.
    const first = events.find((e) => Math.floor(e.start / 24) === i);
    go(first ? first.start : i * 24 + 10);
    if (i === dayOf) frameDay.current(i, true);
  };
  const zoom = (by: number) => {
    const m = map.current;
    if (m) m.stop().easeTo({ zoom: m.getZoom() + by, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220 });
  };
  const reset = () => { setProbe(null); setSelectedPlace(null); frameDay.current(dayOf, true); };
  const icon = (path: string, size = 18) => <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;

  return (
    <section ref={section} aria-label="Wind map" className="wind-instrument">
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

      {probe && probeAt && reading && <div className="wind-probe" style={{left: probeAt.x, top: probeAt.y}}>
        <span className="wind-probe-dot" />
        <div><span className="wind-probe-label">{places.find(p => p.id === selectedPlace)?.name ?? "At this point"}</span><p><strong>{reading.mph} mph</strong> from {compass(reading.from)}</p></div>
        <button type="button" aria-label="Close the reading" onClick={() => setProbe(null)}>{icon("M5 5l8 8M13 5l-8 8")}</button>
      </div>}

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
          <div className="wind-dock-side">
            <div className="wind-stat"><WindGlyph size={24} /><div><p className="wind-stat-name">Gusts</p><p className="wind-stat-value">{windGust} mph</p></div></div>
            {daylight && <div className="wind-stat is-wide"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 7v2M5.6 10.6l1.4 1.4M18.4 10.6 17 12" /></svg><div><p className="wind-stat-name">Daylight</p><p className={`wind-stat-value ${dark ? "is-dark" : ""}`}>{daylight}</p></div></div>}
          </div>

          <div className="wind-dock-compass" role="img" aria-label={`${windSpeed} mph from the ${compass(windDirection)}`}>
            <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
              <circle cx="56" cy="56" r="53" fill="rgb(10 26 21 / .55)" stroke="rgb(233 231 224 / .28)" />
              {TICKS.map((a) => (
                <line key={a} x1="56" y1={a % 30 === 0 ? 14 : 11} x2="56" y2="8" stroke="#e9e7e0" strokeOpacity={a % 30 === 0 ? 0.6 : 0.25} strokeWidth={a % 30 === 0 ? 1.4 : 1} transform={`rotate(${a} 56 56)`} />
              ))}
              <text x="56" y="25" textAnchor="middle" fontSize="10" fontWeight="700" fill="#eceee8">N</text>
              {/* The big mark sits on the side the wind comes from; the small one, where it goes. */}
              <g className="wind-dock-needle" style={{ transform: `rotate(${needle}deg)` }}>
                <path d="M47.5 2.5 L64.5 2.5 L56 18 Z" fill="#d99a6c" />
                <path d="M50.5 98 L61.5 98 L56 108 Z" fill="#d99a6c" fillOpacity=".85" />
              </g>
            </svg>
            <div className="wind-dock-speed" aria-hidden="true">
              <p><strong>{windSpeed}</strong><span>mph</span></p>
              <p>from <b>{compass(windDirection)}</b></p>
            </div>
          </div>

          <div className="wind-dock-side">
            <div className="wind-stat is-quiet"><WeatherGlyph kind={sky.kind} size={22} /><div><p className="wind-stat-name">{sky.label}</p><p className="wind-stat-value">{temperature}°F</p></div></div>
            <div className="wind-stat is-quiet"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2c2.4 2.9 3.8 5 3.8 6.9a3.8 3.8 0 0 1-7.6 0C4.2 7.2 5.6 5.1 8 2.2Z" /></svg><div><p className="wind-stat-name">Rain</p><p className="wind-stat-value">{chance === null ? "n/a" : `${chance}%`}</p></div></div>
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
