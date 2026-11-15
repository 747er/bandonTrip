"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre, Marker, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WindData } from "@/lib/wind";
import { compass, minutesFromStart, SPEED_STOPS } from "@/lib/windMath";
import { WindParticles } from "./particles";

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

// The aerial tiles we host cover these z15 tiles (see scripts/build-tiles.mjs).
const Z15 = { x0: 5059, x1: 5063, y0: 12012, y1: 12019 };
const lonOf = (x: number) => (x / 2 ** 15) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** 15))) * 180) / Math.PI;
const NAIP_BOUNDS: [number, number, number, number] = [lonOf(Z15.x0), latOf(Z15.y1 + 1), lonOf(Z15.x1 + 1), latOf(Z15.y0)];

const DIM = { "raster-brightness-max": 0.7, "raster-saturation": -0.25, "raster-fade-duration": 200 };
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
  const [t, setT] = useState(initialHour);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useRef<MapLibre | null>(null);
  const live = useRef({ t: initialHour, dirty: true });
  const pins = useRef(new Map<string, HTMLElement>());

  // Where the group is at the chosen hour: wherever the day's most recent event began,
  // and home before the day's first one.
  const today = Math.floor(t / 24);
  const lastStarted = events.filter((e) => e.placeId && Math.floor(e.start / 24) === today && e.start <= t + 0.01).at(-1);
  const activePlace = lastStarted?.placeId ?? places.find((p) => p.home)?.id ?? null;
  const active = useRef(activePlace);
  const mark = () => pins.current.forEach((el, id) => el.setAttribute("data-active", String(id === active.current)));
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
    // The library's worker script is copied into public/ at build time (scripts/photos.mjs).
    setWorkerUrl("/maplibre-worker.mjs");
    const m = new MapLibre({
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
          // The wide-area imagery is brighter than ours: dim it further so the join is quiet.
          { id: "wide", type: "raster", source: "wide", paint: { ...DIM, "raster-brightness-max": 0.56 } },
          { id: "naip", type: "raster", source: "naip", paint: DIM },
        ],
      },
      center,
      zoom: 13.4,
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
      const el = document.createElement("div");
      el.className = `group flex cursor-pointer items-center gap-1.5 ${p.side === "left" ? "flex-row-reverse" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `Zoom to ${p.name}`);
      el.addEventListener("click", () => m.flyTo({ center: [p.lon, p.lat], zoom: 15.6, duration: 1400 }));
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

    const particles = new WindParticles(canvas.current);
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
      const box = mapBox.current!;
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
      particles.resize(mapBox.current!.clientWidth, mapBox.current!.clientHeight);
      locate();
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      if (still && frames > 70) return;
      frames++;
      particles.frame();
    };

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
    };
    // The map is built once; later changes reach it through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Playback ----
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setT((now) => (now + 0.15 >= hours - 1 ? 0 : +(now + 0.15).toFixed(2))), 90);
    return () => clearInterval(timer);
  }, [playing, hours]);

  // ---- What the readout says for the chosen hour ----
  const h = Math.min(hours - 1, Math.round(t));
  const local = data.times[h];
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
  const peak = useMemo(() => Math.max(20, ...data.point.gust, ...data.point.speed), [data]);
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

  const jump = (e: WindEvent) => {
    setPlaying(false);
    setT(+e.start.toFixed(2));
    if (e.place) map.current?.flyTo({ center: [e.place[1], e.place[0]], zoom: 15.6, duration: 1600 });
  };
  const scrub = (value: number) => {
    setPlaying(false);
    setT(value);
  };
  const zoom = (by: number) => map.current?.easeTo({ zoom: map.current.getZoom() + by, duration: 300 });
  const reset = () => map.current?.flyTo({ center, zoom: 13.4, duration: 1200 });
  const control =
    "flex h-11 w-11 items-center justify-center bg-forest-deep/85 text-limestone backdrop-blur-md transition-colors hover:bg-forest";

  const dayIndex = Math.max(0, dates.indexOf(date));
  const stats: [string, string][] = [
    ["Gusts", gust[h] > speed[h] ? `${gust[h]} mph` : "None"],
    ["Temp", `${temp[h]}°`],
    ["Rain", rainChance[h] === null ? "n/a" : `${rainChance[h]}%`],
  ];
  const arrow = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 52 52" className="shrink-0" role="img" aria-label={`Wind from the ${compass(direction[h])}`}>
      <circle cx="26" cy="26" r="24" fill="none" stroke="rgb(233 231 224 / 0.25)" strokeWidth="1.5" />
      <text x="26" y="9.5" textAnchor="middle" fontSize="7" fill="rgb(195 208 205)">N</text>
      {/* The arrow points the way the wind is going */}
      <g transform={`rotate(${direction[h] + 180} 26 26)`} style={{ transition: "transform 300ms" }}>
        <path d="M26 12 L32.5 31 L26 27 L19.5 31 Z" fill="#d99a6c" />
      </g>
    </svg>
  );
  const playButton = (className: string) => (
    <button
      type="button"
      aria-pressed={playing}
      aria-label={playing ? "Pause" : "Play through the trip"}
      onClick={() => setPlaying(!playing)}
      className={`flex shrink-0 items-center justify-center bg-limestone text-pine transition-colors hover:bg-paper ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        {playing ? <path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z" /> : <path d="M4 2.2l9.5 5.8L4 13.8z" />}
      </svg>
    </button>
  );
  /** The wind chart for hours [from, to), with a slider laid over it for scrubbing. */
  const chart = (from: number, to: number, className: string) => (
    <div className={`relative ${className}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox={`${from} 0 ${to - from} 100`} preserveAspectRatio="none" aria-hidden="true">
        {nights.map(([a, b]) => (
          <rect key={a} x={a} y="0" width={Math.max(0, b - a)} height="100" fill="rgb(0 0 0 / 0.38)" />
        ))}
        {events
          .filter((e) => e.type === "golf" || e.sunsetNote !== null)
          .map((e) => (
            <rect key={e.id} x={e.start} y="0" width={Math.max(0.6, e.end - e.start)} height="7" fill={e.type === "golf" ? "#e9e7e0" : "#d99a6c"} />
          ))}
        {gust.map((g, i) => (
          <rect key={`g${i}`} x={i + 0.12} y={100 - (Math.max(g, speed[i]) / peak) * 84} width="0.76" height={(Math.max(g, speed[i]) / peak) * 84} fill="rgb(195 208 205 / 0.28)" />
        ))}
        {speed.map((sp, i) => (
          <rect key={`s${i}`} x={i + 0.12} y={100 - (sp / peak) * 84} width="0.76" height={(sp / peak) * 84} fill={i === h ? "#d99a6c" : "rgb(233 231 224 / 0.8)"} />
        ))}
        {dates.slice(1).map((d, i) => (
          <line key={d} x1={(i + 1) * 24} x2={(i + 1) * 24} y1="0" y2="100" stroke="rgb(233 231 224 / 0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={t + 0.5} x2={t + 0.5} y1="0" y2="100" stroke="#d99a6c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* On the one-day chart there is room to say what each mark along the top is. */}
      {to - from <= 24 &&
        events
          .filter((e) => (e.type === "golf" || e.sunsetNote !== null) && e.start >= from && e.start < to)
          .map((e) => (
            <span
              key={e.id}
              className={`pointer-events-none absolute top-[7px] whitespace-nowrap text-[11px] font-semibold leading-none [text-shadow:0_0_3px_rgb(13_33_27)] ${
                e.type === "golf" ? "text-limestone" : "text-copper-light"
              }`}
              style={{ left: `${((e.start - from) / (to - from)) * 100}%` }}
            >
              {e.title}
            </span>
          ))}
      <input
        type="range"
        min={from}
        max={to - 1}
        step={0.25}
        value={Math.min(to - 1, Math.max(from, t))}
        onChange={(e) => scrub(Number(e.target.value))}
        aria-label="Hour"
        aria-valuetext={`${dayLabel(date)} ${hourLabel(local)}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize touch-pan-y opacity-0"
      />
    </div>
  );
  const chip = (e: WindEvent, showDay: boolean) => {
    const on = t >= e.start - 0.01 && t <= Math.max(e.end, e.start + 1);
    return (
      <li key={e.id} className="shrink-0">
        <button
          type="button"
          onClick={() => jump(e)}
          className={`flex min-h-11 flex-col justify-center px-3 py-1.5 text-left transition-colors ${
            on ? "bg-limestone text-pine" : "bg-forest/90 text-limestone hover:bg-forest md:bg-forest-deep/85 md:backdrop-blur-md"
          }`}
        >
          <span className="text-label font-semibold">{e.title}</span>
          <span className={`figures text-fine ${on ? "text-moss" : "text-mist"}`}>
            {showDay ? e.label : e.label.replace(/^\S+ /, "")}
            {e.sunsetNote && <span className={`ml-1.5 font-semibold ${on ? "text-copper" : "text-copper-light"}`}>{e.sunsetNote}</span>}
          </span>
        </button>
      </li>
    );
  };
  const legend = (
    <>
      <span>Calm</span>
      <span
        className="h-1.5 w-28"
        style={{
          background: `linear-gradient(to right, ${SPEED_STOPS.map(([sp, c]) => `rgb(${c.join(" ")}) ${(sp / 35) * 100}%`).join(", ")})`,
        }}
      />
      <span>35 mph</span>
    </>
  );
  const credits = (
    <>
      Imagery USDA NAIP via USGS. Wind{" "}
      <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>
      . Places © OpenStreetMap.
    </>
  );

  return (
    <>
      <section aria-label="Wind map" className="relative isolate h-[100svh] min-h-[560px] overflow-hidden bg-forest-deep text-limestone">
        {/* The map library sets its own positioning on its container, so it gets a plain box inside ours. */}
        <div className="absolute inset-0">
          <div ref={mapBox} className="h-full w-full" />
        </div>
        <canvas ref={canvas} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
        {/* Type sits over the top and bottom of the picture: shade only those. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to bottom, rgb(13 33 27 / 0.75) 0%, rgb(13 33 27 / 0) 20%, rgb(13 33 27 / 0) 62%, rgb(13 33 27 / 0.8) 100%)" }} />

        {/* ---------- Phones: one line of readout, one strip of timeline, and the map ---------- */}
        <p className="figures absolute inset-x-0 top-14 flex items-center gap-2.5 bg-forest-deep/80 px-4 py-1.5 text-label backdrop-blur-md md:hidden">
          {arrow(30)}
          <span className="display text-[30px] leading-none">{speed[h]}</span>
          <span className="font-semibold leading-tight">
            mph
            <span className="block font-medium text-mist">{compass(direction[h])}</span>
          </span>
          <span className="ml-auto flex gap-3.5">
            {gust[h] > speed[h] && (
              <span>
                <span className="text-mist">gusts </span>
                <span className="font-semibold">{gust[h]}</span>
              </span>
            )}
            <span className="font-semibold">{temp[h]}°</span>
            {rainChance[h] !== null && (
              <span>
                <span className="text-mist">rain </span>
                <span className="font-semibold">{rainChance[h]}%</span>
              </span>
            )}
          </span>
        </p>

        <button
          type="button"
          className="absolute right-3 top-[6.75rem] flex h-10 w-10 items-center justify-center bg-forest-deep/80 text-limestone backdrop-blur-md md:hidden"
          aria-label="Back to the whole resort"
          onClick={reset}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4" /></svg>
        </button>

        <div className="absolute inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] bg-forest-deep/88 px-4 pb-2 backdrop-blur-md md:hidden">
          <div role="group" aria-label="Day" className="figures flex items-center text-label">
            {dates.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={i === dayIndex}
                // Keep the hour of day when changing day.
                onClick={() => scrub(Math.min(hours - 1, i * 24 + (t - dayIndex * 24)))}
                className={`min-h-10 pr-4 font-semibold ${i === dayIndex ? "text-limestone underline decoration-copper-light decoration-2 underline-offset-[6px]" : "text-mist"}`}
              >
                {dayLabel(d, "short")}
              </button>
            ))}
            <span className={`ml-auto font-semibold ${dark ? "text-copper-light" : "text-limestone"}`}>
              {hourLabel(local)}
              {dark ? ", dark" : sunset - minuteNow <= 90 && sunset > minuteNow ? `, ${sunset - minuteNow} min of light` : ""}
            </span>
          </div>
          {chart(dayIndex * 24, Math.min(hours, dayIndex * 24 + 24), "h-14")}
          <div className="figures mt-1 grid grid-cols-4 text-fine text-mist" aria-hidden="true">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>Noon</span>
            <span>6 PM</span>
          </div>
        </div>

        {/* ---------- Wider screens: a readout card, map controls and the whole trip on one timeline ---------- */}
        <div className="absolute left-10 top-24 hidden w-[21rem] bg-forest-deep/85 p-5 backdrop-blur-md md:block">
          <p className="text-meta text-mist">
            {dayLabel(date)}, <span className="figures font-semibold text-limestone">{hourLabel(local)}</span>
          </p>
          <div className="mt-2 flex items-center gap-4">
            {arrow(52)}
            <div>
              <p className="display figures text-[60px] leading-none">
                {speed[h]}
                <span className="ml-1.5 font-sans text-ui font-semibold tracking-normal">mph</span>
              </p>
              <p className="mt-1 text-meta font-medium">From the {compass(direction[h])}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-x-3 border-t border-rule-light pt-3">
            {stats.map(([name, value]) => (
              <div key={name} className="flex flex-col-reverse">
                <dt className="text-label text-mist">{name}</dt>
                <dd className="figures text-ui font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {light && (
            <p className={`mt-3 border-t border-rule-light pt-3 text-meta font-medium ${dark ? "text-copper-light" : "text-limestone"}`}>
              {light}
            </p>
          )}
        </div>

        <div className="absolute right-10 top-24 hidden flex-col gap-1.5 md:flex">
          <button type="button" className={control} aria-label="Zoom in" onClick={() => zoom(1)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 3v12M3 9h12" /></svg>
          </button>
          <button type="button" className={control} aria-label="Zoom out" onClick={() => zoom(-1)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 9h12" /></svg>
          </button>
          <button type="button" className={control} aria-label="Back to the whole resort" onClick={reset}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4" /></svg>
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-8 hidden px-10 md:block">
          <div className="mx-auto max-w-6xl">
            <ul className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {events.map((e) => chip(e, true))}
            </ul>
            <div className="flex items-stretch gap-2 bg-forest-deep/85 p-4 backdrop-blur-md">
              {playButton("w-11 self-stretch")}
              <div className="min-w-0 flex-1">
                {chart(0, hours, "h-20")}
                <div className="mt-1.5 flex">
                  {dates.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => scrub(i * 24 + 10)}
                      className={`figures min-h-8 flex-1 text-left text-label ${d === date ? "font-semibold text-limestone" : "text-mist hover:text-limestone"}`}
                    >
                      {dayLabel(d, "short")} {Number(d.slice(8))}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-fine text-mist">
              <p className="flex items-center gap-2">
                {legend}
                <span className="ml-3">White bars: wind each hour. Faint bars behind: gusts. Shaded: night. Marks along the top: tee times.</span>
              </p>
              <p>{credits}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Phones: the key and credits sit under the map, out of its way. */}
      <div className="space-y-2 bg-forest-deep px-5 py-5 text-fine text-mist md:hidden">
        <p className="flex items-center gap-2">{legend}</p>
        <p>White bars: wind each hour. Faint bars behind: gusts. Shaded: night. Marks along the top: tee times. Tap a place name to zoom to it.</p>
        <p>{credits}</p>
      </div>
    </>
  );
}
