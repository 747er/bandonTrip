// The resort's holes, from OpenStreetMap (© OpenStreetMap contributors), fetched by
// scripts/golf-holes.mjs. Client-safe.
import data from "./holes.json";

export type Hole = {
  n: number;
  par: number | null;
  /** The line of play, tee to green, as [longitude, latitude] */
  line: [number, number][];
  /** The green's outline, when OpenStreetMap has one near the end of the line */
  green: [number, number][] | null;
};
export type Course = { name: string; holes: Hole[] };

export const HOLES = data as unknown as Record<string, Course>;

/** The course a schedule entry is played on, by its title: "Old Macdonald" → "old-macdonald". */
const NAMES: [RegExp, string][] = [
  [/sheep ranch/i, "sheep-ranch"],
  [/old mac/i, "old-macdonald"],
  [/pacific dunes/i, "pacific-dunes"],
  [/bandon trails/i, "bandon-trails"],
  [/preserve/i, "bandon-preserve"],
  [/shorty/i, "shortys"],
  [/bandon dunes(?! golf resort)/i, "bandon-dunes"],
];
export const courseFor = (title: string): string | null => NAMES.find(([re]) => re.test(title))?.[1] ?? null;
