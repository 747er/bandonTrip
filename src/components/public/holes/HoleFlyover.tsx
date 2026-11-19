"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibre, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { holeTimes, holeYards } from "@/lib/holeRound";
import { HOLES, type Hole } from "@/lib/holes";
import { clock } from "@/lib/time";
import { describe } from "@/lib/weatherCodes";
import type { WindData } from "@/lib/wind";
import { heading, interpolate, interpolateDirection, timelineLocal, windOnHole } from "@/lib/windMath";
import { WeatherGlyph } from "../Glyphs";
import { aerialStyle } from "../wind/aerial";
import { WindParticles } from "../wind/particles";

export type FlyoverRound = {
  course: string;
  name: string;
  date: string;
  /** "Fri 20" */
  day: string;
  /** The viewer's tee time, "8:30 AM", or null when the round has none */
  tee: string | null;
  /** The tee time as fractional hours into the forecast; -1 when it is not covered */
  teeHour: number;
  number: number | null;
  total: number | null;
};

/** How the wind plays on a hole: into it, helping, across, or too light to matter. */
type Plays = "into" | "help" | "across" | "calm";
/** Below this, in mph, a golfer calls it calm. */
const CALM = 3;
const playsOf = (along: string | null, mph: number): Plays =>
  mph < CALM ? "calm" : along === "into" || along === "into the wind" ? "into" : along === "helping" || along === "downwind" ? "help" : "across";

const CELL = 18; // spacing of the on-screen wind grid, px
const EARTH = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * The camera that stands on a hole's tee looking at its green: turned to the hole's
 * heading, centred on the hole, and zoomed so the whole hole fits the clear part of the
 * screen. Measured along and across the line of play, so a hole running corner to corner
 * fits as snugly as one running up the page.
 */
function cameraFor(hole: Hole, box: { width: number; height: number }, pad: { top: number; bottom: number; left: number; right: number }) {
  const bearing = heading(hole.line);
  const [lon0, lat0] = hole.line[0];
  const k = Math.cos(rad(lat0));
  const b = rad(bearing);
  // Every point of the hole as metres along the line of play and across it.
  const pts = [...hole.line, ...(hole.green ?? []), ...hole.outline.flat(2)];
  let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
  for (const [lon, lat] of pts) {
    const east = rad(lon - lon0) * k * EARTH;
    const north = rad(lat - lat0) * EARTH;
    const along = east * Math.sin(b) + north * Math.cos(b);
    const across = east * Math.cos(b) - north * Math.sin(b);
    a0 = Math.min(a0, along); a1 = Math.max(a1, along);
    c0 = Math.min(c0, across); c1 = Math.max(c1, across);
  }
  const midA = (a0 + a1) / 2;
  const midC = (c0 + c1) / 2;
  const east = midA * Math.sin(b) + midC * Math.cos(b);
  const north = midA * Math.cos(b) - midC * Math.sin(b);
  const center: [number, number] = [lon0 + east / (EARTH * k) * (180 / Math.PI), lat0 + (north / EARTH) * (180 / Math.PI)];
  // Some ground beyond the green and behind the tee, so neither sits on the edge.
  const w = Math.max(40, box.width - pad.left - pad.right);
  const h = Math.max(40, box.height - pad.top - pad.bottom);
  const perPixel = Math.max((a1 - a0 + 50) / h, (c1 - c0 + 40) / w);
  const zoom = Math.min(18.2, Math.log2((40075016.686 * Math.cos(rad(center[1]))) / (512 * perPixel)));
  return { center, zoom, bearing, padding: pad };
}

/** The course's holes as map features: the open hole in full, the others as faint lines with numbers. */
function features(course: string, open: number): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = [];
  for (const hole of HOLES[course]?.holes ?? []) {
    const props = { n: hole.n, on: hole.n === open };
    if (hole.n === open) {
      for (const polygon of hole.outline) out.push({ type: "Feature", properties: { ...props, part: "outline" }, geometry: { type: "Polygon", coordinates: polygon } });
      if (hole.green) out.push({ type: "Feature", properties: { ...props, part: "green" }, geometry: { type: "Polygon", coordinates: [hole.green] } });
      out.push({ type: "Feature", properties: { ...props, part: "tee" }, geometry: { type: "Point", coordinates: hole.line[0] } });
    } else {
      out.push({ type: "Feature", properties: { ...props, part: "badge" }, geometry: { type: "Point", coordinates: hole.line[0] } });
    }
    out.push({ type: "Feature", properties: { ...props, part: "line" }, geometry: { type: "LineString", coordinates: hole.line } });
  }
  return { type: "FeatureCollection", features: out };
}

/** A hole's number in a small dark badge, drawn at twice the size for sharp screens. */
function badge(n: number, font: string): ImageData {
  const k = 2;
  const size = 24 * k;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5 * k, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(13, 33, 27, 0.9)";
  ctx.fill();
  ctx.lineWidth = 1.5 * k;
  ctx.strokeStyle = "rgba(236, 238, 232, 0.75)";
  ctx.stroke();
  ctx.fillStyle = "#eceee8";
  ctx.font = `600 ${11 * k}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), size / 2, size / 2 + 0.75 * k);
  return ctx.getImageData(0, 0, size, size);
}

const icon = (path: string, size = 18, width = 1.6) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
);

export function HoleFlyover({
  wind,
  rounds,
  initial,
  center,
}: {
  wind: WindData | null;
  rounds: FlyoverRound[];
  initial: { round: number; hole: number };
  center: [number, number];
}) {
  const [roundIndex, setRoundIndex] = useState(initial.round);
  const [n, setN] = useState(initial.hole);
  const round = rounds[roundIndex];
  const holes = HOLES[round.course].holes;
  const i = Math.max(0, holes.findIndex((h) => h.n === n));
  const hole = holes[i];
  const pace = useMemo(() => holeTimes(holes), [holes]);

  // ---- The forecast at each hole: on its tee at about the time the group gets there ----
  const hours = wind?.times.length ?? 0;
  const timeAt = (k: number) => (round.teeHour >= 0 ? round.teeHour + pace[k].at / 60 : -1);
  const covered = (t: number) => !!wind && t >= 0 && t <= hours - 1;
  const readingAt = (k: number) => {
    const t = timeAt(k);
    if (!wind || !covered(t)) return null;
    const from = interpolateDirection(wind.point.direction, t);
    const mph = Math.round(interpolate(wind.point.speed, t));
    const { along, across } = windOnHole(holes[k].line, from);
    return {
      t,
      mph,
      gust: Math.round(interpolate(wind.point.gust, t)),
      temp: Math.round(interpolate(wind.point.temp, t)),
      rain: wind.point.rainChance[Math.floor(t)],
      sky: describe(wind.point.code[Math.floor(t)] ?? 3),
      from,
      along: mph < CALM ? "calm" : along,
      across: mph < CALM ? null : across,
      plays: playsOf(along, mph),
    };
  };
  const now = readingAt(i);
  const clockAt = (t: number) => (wind ? clock(timelineLocal(wind.times, t).slice(11)) : "");

  // ---- The map ----
  const section = useRef<HTMLElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const north = useRef<HTMLSpanElement>(null);
  const map = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set when the player has panned or zoomed away from the hole; the hole button brings it back.
  const [wandered, setWandered] = useState(false);
  const live = useRef({ t: now?.t ?? -1, dirty: true });
  const shown = useRef({ course: round.course, n: hole.n });
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** The clear part of the screen: below the top controls and above the sheet. */
  const padding = () => {
    const box = section.current?.getBoundingClientRect();
    const panel = sheet.current?.getBoundingClientRect();
    const phone = (box?.width ?? 0) < 768;
    // On a phone the sheet runs across the bottom; on a wider screen it stands at the left,
    // and the hole gets the full height beside it.
    if (phone) return { top: 84, bottom: box && panel ? Math.max(140, box.bottom - panel.top + 20) : 320, left: 28, right: 28 };
    return { top: 150, bottom: 48, left: box && panel ? panel.right - box.left + 60 : 520, right: 100 };
  };
  const fly = useRef<(animate: boolean) => void>(() => {});

  useEffect(() => {
    if (!mapBox.current || !canvas.current) return;
    setWorkerUrl("/maplibre-worker.mjs");
    const box = { width: mapBox.current.clientWidth, height: mapBox.current.clientHeight };
    const first = HOLES[shown.current.course].holes.find((h) => h.n === shown.current.n)!;
    const start = cameraFor(first, box, padding());
    let m: MapLibre;
    try {
      m = new MapLibre({
        container: mapBox.current,
        style: aerialStyle(),
        center: start.center,
        zoom: start.zoom,
        bearing: start.bearing,
        minZoom: 12,
        maxZoom: 19.5,
        maxBounds: [[center[0] - 0.3, center[1] - 0.2], [center[0] + 0.3, center[1] + 0.2]],
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
    } catch {
      setTimeout(() => setFailed(true), 0);
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.keyboard.disableRotation();
    map.current = m;

    fly.current = (animate) => {
      const hole = HOLES[shown.current.course].holes.find((h) => h.n === shown.current.n);
      const el = mapBox.current;
      if (!hole || !el) return;
      const cam = cameraFor(hole, { width: el.clientWidth, height: el.clientHeight }, padding());
      // Center and zoom are worked out for the clear area, so the padding only shifts the view.
      const options = { center: cam.center, zoom: cam.zoom, bearing: cam.bearing, padding: { top: cam.padding.top, bottom: cam.padding.bottom, left: cam.padding.left, right: cam.padding.right } };
      m.stop();
      if (animate && !reduce()) m.flyTo({ ...options, duration: 1300, curve: 1.25, essential: false });
      else m.jumpTo(options);
      setWandered(false);
    };
    // The constructor can't take padding: settle onto the hole in the clear area now.
    fly.current(false);

    let particles: WindParticles | null = null;
    try { particles = new WindParticles(canvas.current); } catch { /* the map still works without the wind drawn on it */ }

    // Where each on-screen grid cell falls in the forecast grid, and the wind there turned
    // into screen axes for the map's bearing.
    let gw = 0, gh = 0;
    let cellCol = new Float32Array(0), cellRow = new Float32Array(0);
    let windX = new Float32Array(0), windY = new Float32Array(0);
    const grid = wind?.grid;
    const locate = () => {
      const el = mapBox.current;
      if (!el || !grid) return;
      const { lats, lons } = grid;
      gw = Math.ceil(el.clientWidth / CELL) + 2;
      gh = Math.ceil(el.clientHeight / CELL) + 2;
      cellCol = new Float32Array(gw * gh);
      cellRow = new Float32Array(gw * gh);
      windX = new Float32Array(gw * gh);
      windY = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) {
        for (let k = 0; k < gw; k++) {
          const ll = m.unproject([k * CELL, j * CELL]);
          cellCol[j * gw + k] = Math.min(lons.length - 1.001, Math.max(0, ((ll.lng - lons[0]) / (lons.at(-1)! - lons[0])) * (lons.length - 1)));
          cellRow[j * gw + k] = Math.min(lats.length - 1.001, Math.max(0, ((ll.lat - lats[0]) / (lats.at(-1)! - lats[0])) * (lats.length - 1)));
        }
      }
      live.current.dirty = true;
    };
    const blow = () => {
      if (!grid || !wind) return;
      const { lons, u, v } = grid;
      const cols = lons.length;
      const time = Math.min(hours - 1, Math.max(0, live.current.t));
      const h0 = Math.floor(time);
      const h1 = Math.min(hours - 1, h0 + 1);
      const f = time - h0;
      const at = (field: number[][], k: number) => field[h0][k] + (field[h1][k] - field[h0][k]) * f;
      const b = rad(m.getBearing());
      const cos = Math.cos(b), sin = Math.sin(b);
      for (let q = 0; q < gw * gh; q++) {
        const c0 = Math.floor(cellCol[q]);
        const r0 = Math.floor(cellRow[q]);
        const fc = cellCol[q] - c0;
        const fr = cellRow[q] - r0;
        const k = r0 * cols + c0;
        const mix = (field: number[][]) =>
          (at(field, k) * (1 - fc) + at(field, k + 1) * fc) * (1 - fr) + (at(field, k + cols) * (1 - fc) + at(field, k + cols + 1) * fc) * fr;
        const east = mix(u);
        const northward = mix(v);
        // The map is turned by its bearing: what points along the bearing points up the screen.
        windX[q] = east * cos - northward * sin;
        windY[q] = -(east * sin + northward * cos);
      }
      live.current.dirty = false;
    };
    particles?.setSampler((x, y) => {
      const k = Math.floor(x / CELL);
      const j = Math.floor(y / CELL);
      if (k < 0 || j < 0 || k >= gw - 1 || j >= gh - 1) return null;
      const fx = x / CELL - k;
      const fy = y / CELL - j;
      const q = j * gw + k;
      const lerp = (a: Float32Array) => (a[q] * (1 - fx) + a[q + 1] * fx) * (1 - fy) + (a[q + gw] * (1 - fx) + a[q + gw + 1] * fx) * fy;
      return [lerp(windX), lerp(windY)];
    });
    const size = () => {
      if (!mapBox.current) return;
      particles?.resize(mapBox.current.clientWidth, mapBox.current.clientHeight);
      locate();
    };

    let moving = false;
    let frames = 0;
    let last = 0;
    let raf = 0;
    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      if (!particles || time - last < 33 || moving || document.hidden) return;
      last = time;
      if (live.current.dirty) { blow(); frames = 0; }
      if (live.current.t < 0) return;
      // With reduced motion, the streaks are drawn for a moment and then held still.
      if (reduce() && frames > 20) return;
      frames++;
      particles.frame();
    };

    const turn = () => { if (north.current) north.current.style.transform = `rotate(${-m.getBearing()}deg)`; };
    turn();
    m.on("rotate", turn);
    m.on("movestart", (e) => {
      moving = true;
      particles?.clear();
      // A drag or pinch by the player, not one of our flights.
      if ((e as { originalEvent?: Event }).originalEvent) setWandered(true);
    });
    m.on("moveend", () => { moving = false; locate(); });
    // Tapping another hole's number or line opens it.
    const holeAt = (x: number, y: number) => {
      if (!m.getLayer("holes-badge")) return null;
      const hit = m.queryRenderedFeatures([[x - 12, y - 12], [x + 12, y + 12]], { layers: ["holes-badge", "holes-line"] }).find((f) => !f.properties.on);
      return hit ? Number(hit.properties.n) : null;
    };
    m.on("click", (e) => {
      const other = holeAt(e.point.x, e.point.y);
      if (other) setN(other);
    });
    m.on("mousemove", (e) => { m.getCanvas().style.cursor = holeAt(e.point.x, e.point.y) ? "pointer" : ""; });

    m.on("load", async () => {
      size();
      setReady(true);
      raf = requestAnimationFrame(tick);
      await document.fonts.ready;
      if (map.current !== m) return;
      const font = getComputedStyle(mapBox.current ?? document.body).fontFamily;
      for (let k = 1; k <= 19; k++) m.addImage(`badge-${k}`, badge(k, font), { pixelRatio: 2 });
      m.addSource("holes", { type: "geojson", data: features(shown.current.course, shown.current.n) });
      const part = (name: string) => ["==", ["get", "part"], name] as ["==", ["get", string], string];
      // The open hole: its fairway, tees and green as one shape, washed faintly in amber and
      // edged in copper, with the ground showing through; the line of play dotted along it.
      m.addLayer({ id: "holes-outline-fill", type: "fill", source: "holes", filter: part("outline"), paint: { "fill-color": "#d99a6c", "fill-opacity": 0.14 } });
      m.addLayer({ id: "holes-outline", type: "line", source: "holes", filter: part("outline"), layout: { "line-join": "round" }, paint: { "line-color": "#e7a77a", "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 18, 2.5], "line-opacity": 0.95 } });
      m.addLayer({ id: "holes-green", type: "fill", source: "holes", filter: part("green"), paint: { "fill-color": "#f0c2a0", "fill-opacity": 0.38 } });
      m.addLayer({
        id: "holes-line", type: "line", source: "holes", filter: part("line"),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "on"], "#f4d9c4", "#eceee8"],
          "line-width": ["case", ["get", "on"], 2.5, 1.5],
          "line-opacity": ["case", ["get", "on"], 0.95, 0.4],
          "line-dasharray": [0.6, 2.2],
        },
      });
      m.addLayer({ id: "holes-tee", type: "circle", source: "holes", filter: part("tee"), paint: { "circle-radius": 6, "circle-color": "#0d211b", "circle-stroke-color": "#f4d9c4", "circle-stroke-width": 2.5 } });
      m.addLayer({ id: "holes-badge", type: "symbol", source: "holes", filter: part("badge"), layout: { "icon-image": ["concat", "badge-", ["to-string", ["get", "n"]]], "icon-padding": 1, "icon-rotation-alignment": "viewport" }, paint: { "icon-opacity": 0.85 } });
    });
    const observer = new ResizeObserver(() => { m.resize(); size(); });
    observer.observe(mapBox.current);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      particles?.destroy();
      m.remove();
      map.current = null;
    };
    // The map is built once; later changes reach it through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new hole: redraw, fly there, and set the wind's clock to when the group gets there.
  useEffect(() => {
    const changed = shown.current.course !== round.course || shown.current.n !== hole.n;
    shown.current = { course: round.course, n: hole.n };
    map.current?.getSource<GeoJSONSource>("holes")?.setData(features(round.course, hole.n));
    live.current = { t: now?.t ?? -1, dirty: true };
    if (changed) fly.current(true);
    // Keep the address on the hole, so a link or a reload comes back to it.
    const url = `/holes?course=${round.course}&hole=${hole.n}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [round.course, hole.n, now?.t]);

  const chooseRound = (k: number) => {
    setRoundIndex(k);
    setN(HOLES[rounds[k].course].holes[0].n);
  };

  // The walk runs one way through the round: back stops at the first hole, and on from
  // the last goes to the first tee of the next round (stopping after the last round).
  const nextRound = i === holes.length - 1 && roundIndex + 1 < rounds.length ? roundIndex + 1 : -1;
  const canBack = i > 0;
  const canOn = i < holes.length - 1 || nextRound >= 0;
  const step = (by: number) => {
    if (by < 0 && canBack) setN(holes[i - 1].n);
    else if (by > 0 && i < holes.length - 1) setN(holes[i + 1].n);
    else if (by > 0 && nextRound >= 0) chooseRound(nextRound);
  };
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });
  // The arrow keys walk the round, ahead of the map's own keyboard panning.
  useEffect(() => {
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
  }, []);

  // A sideways swipe on the sheet steps a hole.
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // The wind as the player stands on the tee: up the screen is toward the green.
  const relative = now ? now.from + 180 - heading(hole.line) : 0;
  const yards = holeYards(hole.line);

  return (
    <section ref={section} aria-label="Hole by hole" className="flyover">
      <div className="absolute inset-0"><div ref={mapBox} className="h-full w-full" /></div>
      <canvas ref={canvas} aria-hidden="true" className={`wind-canvas ${ready && now ? "is-ready" : ""}`} />
      <div className="wind-map-shade" aria-hidden="true" />
      {!ready && <p className="wind-map-status" role="status">{failed ? "Map unavailable. The hole’s forecast is still below." : "Loading resort imagery…"}</p>}

      <div className="flyover-top">
        <label className="flyover-round">
          <select aria-label="Round" value={roundIndex} onChange={(e) => chooseRound(Number(e.target.value))}>
            {rounds.map((r, k) => <option key={r.course + r.date} value={k}>{r.day.split(" ")[0]} · {r.name}{r.tee ? ` · ${r.tee.replace(/ [AP]M$/, "")}` : ""}</option>)}
          </select>
          {icon("M5 7l4 4 4-4", 16)}
        </label>
      </div>
      <div className="flyover-tools">
        {wandered && (
          <button type="button" onClick={() => fly.current(true)} aria-label={`Back to hole ${hole.n}`} title={`Back to hole ${hole.n}`}>
            {icon("M3 7V3h4M15 7V3h-4M3 11v4h4M15 11v4h-4", 16)}
          </button>
        )}
        <span className="flyover-north" role="img" aria-label="North">
          <span ref={north}><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 2.5l4 9h-8z" fill="#d99a6c" /><path d="M7 11.5h8l-4 8z" fill="rgb(233 231 224 / .35)" /></svg></span>
          <b>N</b>
        </span>
      </div>

      <div
        ref={sheet}
        className="flyover-sheet"
        role="region"
        aria-label={`Hole ${hole.n}`}
        onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}
      >
        {/* One hole at a time: its number between the steps to the holes either side. */}
        <div className="flyover-hole">
          <button type="button" className="flyover-step" onClick={() => step(-1)} disabled={!canBack} aria-label={canBack ? `Previous hole, ${holes[i - 1].n}` : "Previous hole"}>{icon("M11 4L6 9l5 5")}</button>
          <span className="flyover-number" aria-hidden="true">{hole.n}</span>
          <div className="min-w-0" aria-hidden="true">
            <p className="flyover-facts">{hole.par ? `Par ${hole.par} · ` : ""}about {yards} yds</p>
            {/* The time never gives way: on a narrow phone only the words after it shorten. */}
            <p className="flyover-when">{now ? <>About <b>{clockAt(now.t)}</b> <span>on the tee</span></> : <span>{round.tee ? `Tee time ${round.tee}` : round.name}</span>}</p>
          </div>
          <button type="button" className="flyover-step" onClick={() => step(1)} disabled={!canOn} aria-label={i < holes.length - 1 ? `Next hole, ${holes[i + 1].n}` : nextRound >= 0 ? `Next round, ${rounds[nextRound].name}` : "Next hole"}>{icon("M7 4l5 5-5 5")}</button>
        </div>

        <p className="sr-only" aria-live="polite">
          Hole {hole.n} of {holes.length}{hole.par ? `, par ${hole.par}` : ""}, about {yards} yards.
          {now ? ` On the tee about ${clockAt(now.t)}. ${now.mph} mph ${now.along ?? "crosswind"}${now.across ? `, ${now.across}` : ""}. Gusts ${now.gust}.` : ""}
        </p>
        {now ? (
          <div className="flyover-wind" aria-hidden="true">
            <span className="flyover-arrow" style={{ "--turn": `${relative}deg` } as CSSProperties} aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 3L18 19L12 15.5L6 19Z" fill="currentColor" /></svg>
            </span>
            <p>
              <strong>{now.mph} mph</strong> <em className={`is-${now.plays}`}>{now.along ?? "crosswind"}</em>
              {now.across && <span className="flyover-across"> · {now.across}</span>}
            </p>
            <p className="flyover-extra">
              Gusts {now.gust}{now.rain !== null ? ` · Rain ${now.rain}%` : ""} · <span className="flyover-sky"><WeatherGlyph kind={now.sky.kind} size={16} />{now.temp}°<span className="sr-only">, {now.sky.label}</span></span>
            </p>
          </div>
        ) : (
          <p className="flyover-none">
            {wind ? "The hour-by-hour forecast doesn’t reach this round yet. Check back closer to the day." : "The forecast isn’t available right now."}
          </p>
        )}
      </div>
    </section>
  );
}
