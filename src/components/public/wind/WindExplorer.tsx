"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre, Marker, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WindData } from "@/lib/wind";
import coast from "@/lib/coast.json";
import { compass, interpolate, interpolateDirection, timelineLocal, minutesFromStart, SPEED_STOPS } from "@/lib/windMath";
import { WindParticles } from "./particles";
import { ForecastTimeline } from "./ForecastTimeline";

export type WindEvent = {
  id: string;
  title: string;
  type: string;
  /** Hours from the first hour of the data, fractional */
  start: number;
  end: number;
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
const NAIP_PAINT = { "raster-brightness-max": 0.84, "raster-saturation": -0.2, "raster-fade-duration": 200 };
const WIDE_PAINT = { "raster-brightness-max": 0.52, "raster-saturation": -0.42, "raster-fade-duration": 200 };

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
      img.data[i] = 13;
      img.data[i + 1] = 33;
      img.data[i + 2] = 27;
      img.data[i + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}
const CELL = 18; // spacing of the on-screen wind grid, px

const hourLabel = (local: string) => {
  const h = Number(local.slice(11, 13));
  return `${h % 12 || 12}:${local.slice(14, 16)} ${h < 12 ? "AM" : "PM"}`;
};
const dayLabel = (date: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("en-US", { weekday: style, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function WindExplorer({
  data,
  events,
  places,
  center,
  initialHour,
}: {
  data: WindData;
  events: WindEvent[];
  places: WindPlace[];
  center: [number, number];
  initialHour: number;
}) {
  const hours = data.times.length;
  const [t, setT] = useState(Math.max(0, Math.min(hours - 1, initialHour)));
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [wholeTrip, setWholeTrip] = useState(false);
  const [flowing, setFlowing] = useState(true);
  const flow = useRef(true);
  const [mapFailed, setMapFailed] = useState(false);
  useEffect(() => { flow.current = flowing; }, [flowing]);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
  const home = useRef<() => void>(() => {});

  // Where the group is at the chosen hour: wherever the day's most recent event began,
  // and home before the day's first one.
  const today = Math.floor(t / 24);
  const lastStarted = events.filter((e) => e.placeId && Math.floor(e.start / 24) === today && e.start <= t).at(-1);
  const activePlace = selectedPlace ?? lastStarted?.placeId ?? places.find((p) => p.home)?.id ?? null;
  const active = useRef(activePlace);
  const mark = () => pins.current.forEach((el, id) => {
    el.setAttribute("data-active", String(id === active.current));
    el.setAttribute("aria-pressed", String(id === active.current));
  });
  useEffect(() => {
    active.current = activePlace;
    mark();
  }, [activePlace]);

  useEffect(() => {
    live.current.t = t;
    live.current.dirty = true;
  }, [t]);

  // ---- The map, the wind grid and the particle loop ----
  useEffect(() => {
    if (!mapBox.current || !canvas.current) return;
    // Open with every pin in view, clear of whatever sits over the map at this width.
    const pinElements = pins.current;
    const phone = mapBox.current.clientWidth < 768;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pinLons = places.map((p) => p.lon);
    const pinLats = places.map((p) => p.lat);
    const frame = {
      bounds: (places.length
        ? [
            [Math.min(...pinLons), Math.min(...pinLats)],
            [Math.max(...pinLons), Math.max(...pinLats)],
          ]
        : [
            [center[0] - 0.02, center[1] - 0.02],
            [center[0] + 0.02, center[1] + 0.02],
          ]) as [[number, number], [number, number]],
      options: {
        // Labels run to the right of their pins, so that side needs the most room.
        padding: phone
          ? { top: 122, bottom: 360, left: 38, right: 155 }
          : { top: 120, bottom: 350, left: 350, right: 180 },
        maxZoom: 14.4,
      },
    };
    home.current = () => {
      const phoneNow = (mapBox.current?.clientWidth ?? 0) < 768;
      m.stop().fitBounds(frame.bounds, { ...frame.options, padding: phoneNow
        ? { top: 122, bottom: 360, left: 38, right: 155 }
        : { top: 120, bottom: 350, left: 350, right: 180 }, duration: reduce.matches ? 0 : 750 });
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
          { id: "ground", type: "background", paint: { "background-color": "#0d211b" } },
          { id: "wide", type: "raster", source: "wide", paint: WIDE_PAINT },
          { id: "naip", type: "raster", source: "naip", paint: NAIP_PAINT },
          { id: "sea", type: "raster", source: "sea", paint: { "raster-fade-duration": 0 } },
        ],
      },
      bounds: frame.bounds,
      fitBoundsOptions: frame.options,
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

    const ICONS = {
      home: '<path d="M2.5 7.5L8 3l5.5 4.5V13h-11z"/>',
      golf: '<path d="M5 14V2.5l7 2.7L5 8"/>',
      dining: '<path d="M4 2v4.5a1.5 1.5 0 003 0V2M5.5 8v6M11.5 14V2c-1.6 1.2-2.2 3.2-2.2 5.5h2.2"/>',
      other: '<circle cx="8" cy="8" r="2.5" fill="currentColor"/>',
    };
    for (const p of places) {
      // A badge with the place's icon, and its name. Whichever place the group is at for
      // the chosen hour is marked data-active and turns copper (see the effect below).
      const el = document.createElement("button");
      el.type = "button";
      el.className = `wind-pin group flex cursor-pointer items-center gap-1.5 ${p.side === "left" ? "flex-row-reverse" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Zoom to ${p.name}`);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectedPlace(p.id);
        setSelectedEvent(null);
        setProbe({ lng: p.lon, lat: p.lat });
        m.stop().flyTo({ center: [p.lon, p.lat], zoom: 15.6, padding: {top: 100, bottom: 290, left: 36, right: 36}, duration: reduce.matches ? 0 : 850 });
      });
      el.innerHTML = `<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-paper bg-forest-deep text-paper shadow-md transition-colors duration-300 group-data-[active=true]:bg-copper"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${
        ICONS[p.kind]
      }</svg></span><span class="whitespace-nowrap bg-paper/95 px-1.5 py-0.5 text-[13px] font-semibold text-pine shadow-md transition-colors duration-300 group-data-[active=true]:bg-copper group-data-[active=true]:text-paper"></span>`;
      (el.lastElementChild as HTMLElement).textContent = p.name;
      new Marker({ element: el, anchor: p.side === "left" ? "right" : "left", offset: [p.side === "left" ? 12 : -12, 0] })
        .setLngLat([p.lon, p.lat])
        .addTo(m);
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

  // ---- Playback ----
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (!document.hidden) setT(now => Math.min(hours - 1, now + 1 / 30));
    }, 50);
    return () => clearInterval(timer);
  }, [playing, hours]);

  useEffect(() => {
    if (playing && t >= hours - 1) {
      const stop = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(stop);
    }
  }, [playing, t, hours]);

  // ---- What the readout says for the chosen hour ----
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
  const light =
    !day || sunrise < 0
      ? null
      : minuteNow < sunrise
        ? `Dark until sunrise at ${hourLabel(day.sunrise)}`
        : minuteNow >= sunset
          ? `Dark. The sun set at ${hourLabel(day.sunset)}`
          : sunset - minuteNow <= 90
            ? `${sunset - minuteNow} min of daylight left`
            : `Sunset at ${hourLabel(day.sunset)}`;
  const dark = day && sunrise >= 0 ? minuteNow < sunrise || minuteNow >= sunset : false;
  const { speed, gust, direction, temp, rainChance } = data.point;
  const windSpeed = Math.round(interpolate(speed, t));
  const windGust = Math.round(interpolate(gust, t));
  const windDirection = interpolateDirection(direction, t);
  const temperature = Math.round(interpolate(temp, t));
  const chance = rainChance[Math.min(hours - 1, Math.floor(t))];
  const dates = useMemo(() => [...new Set(data.times.map((x) => x.slice(0, 10)))], [data]);
  const nights = useMemo(() => {
    // Shade from each sunset to the next sunrise, plus the edges of the range.
    const edges = data.days.flatMap((d) => [minutesFromStart(data.times, d.sunrise) / 60, minutesFromStart(data.times, d.sunset) / 60]);
    const spans: [number, number][] = [];
    let from = 0;
    for (let i = 0; i < edges.length; i += 2) {
      spans.push([from, edges[i]]);
      from = edges[i + 1];
    }
    spans.push([from, hours]);
    return data.days.length ? spans : [];
  }, [data, hours]);

  // Camera changes belong exclusively to explicit map/location actions.
  const jump = (e: WindEvent) => {
    setPlaying(false);
    setSelectedEvent(e.id);
    setSelectedPlace(e.placeId);
    setT(Math.min(hours - 1, e.start));
    if (e.place) {
      setProbe({lng: e.place[1], lat: e.place[0]});
      map.current?.stop().flyTo({ center: [e.place[1], e.place[0]], zoom: 15.6,
        padding: {top: 100, bottom: 290, left: 36, right: 36},
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850 });
    } else setProbe(null);
  };
  const scrub = (value: number) => {
    setPlaying(false);
    setSelectedPlace(null);
    setSelectedEvent(null);
    setT(Math.max(0, Math.min(hours - 1, value)));
  };
  const zoom = (by: number) => {
    const m = map.current;
    if (m) m.stop().easeTo({ zoom: m.getZoom() + by, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220 });
  };
  const reset = () => { setProbe(null); home.current(); };
  const dayIndex = Math.max(0, dates.indexOf(date));
  const activeName = places.find(p => p.id === activePlace)?.name;
  const dayEvents = events.filter(e => Math.floor(e.start / 24) === dayIndex);
  const stats = [["Gusts", `${windGust} mph`], ["Temp", `${temperature}°F`], ["Rain", chance === null ? "n/a" : `${chance}%`]];
  const arrow = (
    <svg width="52" height="52" viewBox="0 0 52 52" className="wind-compass" role="img" aria-label={`Wind from the ${compass(windDirection)}`}>
      <circle cx="26" cy="26" r="24" fill="none" stroke="rgb(233 231 224 / .3)" />
      <path d="M26 3v3M49 26h-3M26 49v-3M3 26h3" stroke="rgb(233 231 224 / .6)" />
      <text x="26" y="13" textAnchor="middle" fontSize="8" fill="#c3d0cd">N</text>
      <g transform={`rotate(${windDirection + 180} 26 26)`}><path d="M26 16L32 34L26 30L20 34Z" fill="#d99a6c" /></g>
    </svg>
  );
  const icon = (path: string) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
  return (
    <section aria-label="Wind map" className="wind-instrument">
      <div className="absolute inset-0"><div ref={mapBox} className="h-full w-full" /></div>
      <canvas ref={canvas} aria-hidden="true" className={`wind-canvas ${ready ? "is-ready" : ""}`} />
      <div className="wind-map-shade" aria-hidden="true" />
      {!ready && <p className="wind-map-status" role="status">{mapFailed ? "Map unavailable. Forecast and itinerary remain available below." : "Loading resort imagery…"}</p>}

      <aside className="wind-readout" aria-label="Resort forecast">
        <div className="wind-readout-heading"><h2>Resort forecast</h2><span>Pacific time</span></div>
        <div className="wind-main-reading">
          {arrow}<p className="wind-speed tabular">{windSpeed}<span>mph<small>from {compass(windDirection)}</small></span></p>
          <dl className="wind-stats">{stats.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        </div>
        <div className="wind-context"><span>{selectedPlace ? "Selected" : "Itinerary"}</span><strong>{activeName ?? "Resort overview"}</strong></div>
        <p className={`wind-daylight ${dark ? "is-dark" : ""}`}><span className="wind-daylight-full">{light ?? "Daylight information unavailable"}</span><span className="wind-daylight-compact">{dark ? "After dark" : sunset > minuteNow && sunset - minuteNow <= 90 ? `${sunset - minuteNow} min of light` : day ? `Sunset ${hourLabel(day.sunset)}` : ""}</span></p>
      </aside>

      <div className="wind-map-tools" role="group" aria-label="Map controls">
        <span className="wind-north" aria-label="North is up">N{icon("M9 15V3M5 7l4-4 4 4")}</span>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1)}>{icon("M9 3v12M3 9h12")}</button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoom(-1)}>{icon("M3 9h12")}</button>
        <button type="button" title="Reset to resort overview" aria-label="Reset to resort overview" onClick={reset}>{icon("M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4")}</button>
        <button type="button" title={flowing ? "Freeze wind particles" : "Animate wind particles"} aria-label={flowing ? "Freeze wind particles" : "Animate wind particles"} aria-pressed={flowing} onClick={() => setFlowing(!flowing)}>{icon("M2 6h9a2 2 0 1 0-2-2M2 10h12a2 2 0 1 1-2 2M2 14h4")}</button>
      </div>

      {probe && probeAt && reading && <div className="wind-probe" style={{left: probeAt.x, top: probeAt.y}}>
        <span className="wind-probe-dot" />
        <div><span className="wind-probe-label">{places.find(p => p.id === selectedPlace)?.name ?? "At this point"}</span><p><strong>{reading.mph} mph</strong> from {compass(reading.from)}</p></div>
        <button type="button" aria-label="Close the reading" onClick={() => setProbe(null)}>{icon("M5 5l8 8M13 5l-8 8")}</button>
      </div>}

      <div className="wind-console">
        <div className="wind-timebar">
          <div className="wind-transport">
            <button type="button" aria-label="Previous hour" disabled={t <= 0} onClick={() => scrub(t - 1)}>{icon("M11 4L6 9l5 5")}</button>
            <button type="button" className="wind-play" aria-label={playing ? "Pause forecast" : "Play forecast"} aria-pressed={playing} onClick={() => {
              setSelectedPlace(null); setSelectedEvent(null);
              if (t >= hours - 1) setT(0);
              setPlaying(!playing);
            }}>{icon(playing ? "M6 4v10M12 4v10" : "M6 3l9 6-9 6V3")}</button>
            <button type="button" aria-label="Next hour" disabled={t >= hours - 1} onClick={() => scrub(t + 1)}>{icon("M7 4l5 5-5 5")}</button>
          </div>
          <div className="wind-time tabular"><strong>{hourLabel(local)}</strong><span>{dayLabel(date, "short")}, {new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", timeZone: "UTC"}).format(new Date(`${date}T12:00:00Z`))}</span></div>
          <div className="wind-range-switch" role="group" aria-label="Timeline range"><button type="button" aria-pressed={!wholeTrip} onClick={() => setWholeTrip(false)}>Day</button><button type="button" aria-pressed={wholeTrip} onClick={() => setWholeTrip(true)}>Trip</button></div>
        </div>
        <div className="wind-days" role="group" aria-label="Forecast day">{dates.map((d, i) => <button key={d} type="button" aria-pressed={i === dayIndex} onClick={() => scrub(i * 24 + t % 24)}><span>{dayLabel(d, "short")}</span><span className="tabular">{Number(d.slice(8))}</span></button>)}</div>
        <div className="wind-chart-key"><span><i />Wind</span><span><i className="gust-key" />Gusts</span><span><i className="night-key" />Night</span><span><i className="tee-key" />Tee times</span><span className="ml-auto">mph</span></div>
        <ForecastTimeline data={data} events={events} time={t} from={wholeTrip ? 0 : dayIndex * 24} to={wholeTrip ? hours : Math.min(hours, dayIndex * 24 + 24)} nights={nights} onChange={scrub} />
        <ul className="wind-events" aria-label="Itinerary destinations">{(wholeTrip ? events : dayEvents).map(e => {
          const on = selectedEvent ? selectedEvent === e.id : t >= e.start && t < Math.max(e.end, e.start + 1);
          return <li key={e.id}><button type="button" aria-pressed={on} onClick={() => jump(e)}><strong>{e.title}</strong><span>{wholeTrip ? e.label : e.label.replace(/^\S+ /, "")}{e.sunsetNote && <em>{e.sunsetNote}</em>}</span></button></li>;
        })}{!wholeTrip && dayEvents.length === 0 && <li className="wind-empty">No events scheduled this day</li>}</ul>
        <div className="wind-console-footer"><span>Scrub to explore · Select a destination to fly</span><div className="wind-speed-key"><span>0</span><i style={{background: `linear-gradient(to right, ${SPEED_STOPS.map(([sp,c]) => `rgb(${c.join(" ")}) ${sp / 35 * 100}%`).join(",")})`}} /><span>35+ mph</span></div></div>
      </div>
      <p className="wind-attribution">Imagery USDA NAIP / USGS · Wind <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Places © OpenStreetMap</p>
    </section>
  );
}
