// A round walked hole by hole: how long each hole is, which way it plays, and roughly
// when the player gets to it from their tee time. Client-safe.

import type { Hole } from "./holes";

const EARTH = 6371000;
const YARDS_PER_METRE = 1.09361;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * The length of a hole's line of play, tee to green, in yards. OpenStreetMap draws the
 * line from one tee to the green's middle, so this is an estimate: it can be off the card
 * by a few yards either way, and it says nothing about which tee is being played.
 */
export function holeYards(line: [number, number][]): number {
  let metres = 0;
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1];
    const [x2, y2] = line[i];
    const east = rad(x2 - x1) * Math.cos(rad((y1 + y2) / 2)) * EARTH;
    const north = rad(y2 - y1) * EARTH;
    metres += Math.hypot(east, north);
  }
  return Math.round(metres * YARDS_PER_METRE);
}

/**
 * Minutes a group takes over a hole, by par: about four hours for a round of 72, the same
 * length the wind page assumes for a round. Holes with no par are taken as par 4s.
 */
const PACE: Record<number, number> = { 3: 11, 4: 13.5, 5: 16 };
export const minutesFor = (par: number | null) => PACE[par ?? 4] ?? PACE[4];

export type HoleTime = {
  n: number;
  /** Minutes after the tee time that the group reaches this hole's tee */
  at: number;
  /** Minutes after the tee time that the group walks off its green */
  until: number;
};

/** When the group is on each hole, as minutes after its tee time, in playing order. */
export function holeTimes(holes: Pick<Hole, "n" | "par">[]): HoleTime[] {
  let clock = 0;
  return holes.map((h) => {
    const at = clock;
    clock += minutesFor(h.par);
    return { n: h.n, at: Math.round(at), until: Math.round(clock) };
  });
}

// ---- Where the player is standing ----

/** Metres east and north of `origin` for a [longitude, latitude] point. */
const local = (origin: [number, number], [lon, lat]: [number, number]): [number, number] => [
  rad(lon - origin[0]) * Math.cos(rad(origin[1])) * EARTH,
  rad(lat - origin[1]) * EARTH,
];

/** The distance between two [longitude, latitude] points, in yards. */
export function yardsBetween(a: [number, number], b: [number, number]): number {
  const [east, north] = local(a, b);
  return Math.round(Math.hypot(east, north) * YARDS_PER_METRE);
}

/** The middle of a hole's green: the centre of its outline, or the end of the line of play without one. */
export function greenCenter(hole: Pick<Hole, "line" | "green">): [number, number] {
  const ring = hole.green;
  if (!ring?.length) return hole.line[hole.line.length - 1];
  // The centroid of the outline as drawn (by area, so unevenly spaced points don't pull it).
  const o = ring[0];
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = local(o, ring[i]);
    const [x2, y2] = local(o, ring[(i + 1) % ring.length]);
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-6) return hole.line[hole.line.length - 1];
  const cx = x / (3 * area);
  const cy = y / (3 * area);
  return [o[0] + (cx / (EARTH * Math.cos(rad(o[1])))) * (180 / Math.PI), o[1] + (cy / EARTH) * (180 / Math.PI)];
}

const inside = ([x, y]: [number, number], ring: [number, number][]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/** Metres from a point to a hole's line of play. */
function metresToLine(p: [number, number], line: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = local(p, line[i - 1]);
    const [bx, by] = local(p, line[i]);
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
  }
  return best;
}

/** How close to a line of play counts as being on that hole, where no outline covers the spot. */
const NEAR_LINE = 35;

/**
 * The hole a player standing at `p` is on, among `holes`: the one whose outline (fairway,
 * tees and green) they are inside, or failing that the one whose line of play passes
 * within 35 metres. Null when they are on none of them.
 */
export function holeAtPoint(p: [number, number], holes: Pick<Hole, "n" | "line" | "outline">[]): number | null {
  for (const hole of holes) {
    if (hole.outline.some((polygon) => inside(p, polygon[0]) && !polygon.slice(1).some((hole) => inside(p, hole)))) return hole.n;
  }
  let best: { n: number; d: number } | null = null;
  for (const hole of holes) {
    const d = metresToLine(p, hole.line);
    if (d <= NEAR_LINE && (!best || d < best.d)) best = { n: hole.n, d };
  }
  return best?.n ?? null;
}
