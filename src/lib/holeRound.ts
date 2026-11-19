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
