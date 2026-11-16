// Fetches every hole at the resort from OpenStreetMap (© OpenStreetMap contributors,
// ODbL) and writes src/lib/holes.json: for each course, its holes in order, each as the
// line of play from tee to green, with its par and the outline of its green. The wind
// map draws them over the aerial imagery.
//
//   node scripts/golf-holes.mjs
//
// Only the resort's bounding box is sent, to the public Overpass service.
import { writeFileSync } from "node:fs";

const BOX = [43.15, -124.425, 43.24, -124.36]; // south, west, north, east

/** The courses, and how each one's holes are recognised in OpenStreetMap. */
const COURSES = [
  { id: "sheep-ranch", name: "Sheep Ranch", area: "Bandon Sheep Ranch" },
  { id: "old-macdonald", name: "Old Macdonald", tag: "Old Macdonald" },
  { id: "pacific-dunes", name: "Pacific Dunes", prefix: /^pacific dunes\s+hole/ },
  { id: "bandon-dunes", name: "Bandon Dunes", prefix: /^bandon dunes\s+hole/ },
  { id: "bandon-trails", name: "Bandon Trails", prefix: /^bandon trails\s+hole/ },
  { id: "bandon-preserve", name: "Bandon Preserve", prefix: /^bandon preserve\s+hole/ },
  { id: "shortys", name: "Shorty's", area: "Shortys" },
];

const query = `[out:json][timeout:90];
(
  way["golf"~"^(hole|green)$"](${BOX.join(",")});
  way["leisure"="golf_course"](${BOX.join(",")});
);
out geom;`;
// The public service is busy at times: wait and try again a few times.
let res;
for (let attempt = 0; attempt < 5; attempt++) {
  if (attempt) await new Promise((r) => setTimeout(r, 15000));
  res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "golf-hole-map/1.0" },
    body: new URLSearchParams({ data: query }),
  });
  if (res.ok || ![429, 502, 503, 504].includes(res.status)) break;
}
if (!res.ok) throw new Error(`Overpass: ${res.status}`);
const { elements } = await res.json();

const points = (way) => way.geometry.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
const inside = ([x, y], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
/** Metres between two [lon, lat] points (near enough at this scale) */
const metres = ([x1, y1], [x2, y2]) => {
  const k = Math.cos((y1 * Math.PI) / 180);
  return Math.hypot((x2 - x1) * k, y2 - y1) * 111320;
};
const centre = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

const areas = Object.fromEntries(
  elements.filter((e) => e.tags?.leisure === "golf_course").map((e) => [e.tags.name, points(e)]),
);
/** Drops points that sit within `tolerance` metres of the line through their neighbours. */
const simplify = (line, tolerance = 1) => {
  if (line.length < 4) return line;
  const [a, b] = [line[0], line.at(-1)];
  let far = 0;
  let at = 0;
  for (let i = 1; i < line.length - 1; i++) {
    // Distance from the point to the chord, in metres.
    const ab = metres(a, b);
    const d = ab === 0 ? metres(a, line[i]) : Math.abs(cross(a, b, line[i])) / ab;
    if (d > far) [far, at] = [d, i];
  }
  return far <= tolerance ? [a, b] : [...simplify(line.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(line.slice(at), tolerance)];
};
const cross = ([x1, y1], [x2, y2], [x, y]) => {
  const k = Math.cos((y1 * Math.PI) / 180) * 111320;
  return ((x2 - x1) * k * (y - y1) * 111320 - (y2 - y1) * 111320 * (x - x1) * k);
};
const greens = elements
  .filter((e) => e.tags?.golf === "green")
  .map((e) => ({ ring: simplify(points(e)).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]), at: centre(points(e)) }));

const courseOf = (way) => {
  const t = way.tags;
  const name = (t.name ?? "").toLowerCase();
  const line = points(way);
  const middle = line[Math.floor(line.length / 2)];
  return COURSES.find(
    (c) =>
      (c.tag && t["golf:course:name"] === c.tag) ||
      (c.prefix && c.prefix.test(name)) ||
      (c.area && areas[c.area] && inside(middle, areas[c.area])),
  );
};

const out = Object.fromEntries(COURSES.map((c) => [c.id, { name: c.name, holes: [] }]));
const unplaced = [];
for (const way of elements.filter((e) => e.tags?.golf === "hole")) {
  const course = courseOf(way);
  const n = Number(way.tags.ref);
  if (!course || !Number.isInteger(n)) {
    unplaced.push(way.id);
    continue;
  }
  const line = points(way);
  // The green the line ends on: the nearest green to its last point, if one is close.
  const end = line.at(-1);
  const near = greens.map((g) => ({ g, d: metres(end, g.at) })).sort((a, b) => a.d - b.d)[0];
  out[course.id].holes.push({
    n,
    par: way.tags.par ? Number(way.tags.par) : null,
    line,
    green: near && near.d < 45 ? near.g.ring : null,
  });
}
for (const course of Object.values(out)) course.holes.sort((a, b) => a.n - b.n);

writeFileSync("src/lib/holes.json", JSON.stringify(out) + "\n");
for (const [id, c] of Object.entries(out)) {
  const nums = c.holes.map((h) => h.n);
  const missing = Array.from({ length: Math.max(0, ...nums) }, (_, i) => i + 1).filter((n) => !nums.includes(n));
  console.log(`${id}: ${c.holes.length} holes, ${c.holes.filter((h) => h.green).length} greens${missing.length ? `, missing ${missing}` : ""}`);
}
if (unplaced.length) console.log(`not placed on a course: ${unplaced.join(", ")}`);
