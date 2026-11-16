// Fetches every hole at the resort from OpenStreetMap (© OpenStreetMap contributors,
// ODbL) and writes src/lib/holes.json: for each course, its holes in order, each as the
// line of play from tee to green, with its par, the outline of its green, and the outline
// of the hole as played: its fairway (trimmed to this hole where a fairway is shared with
// its neighbours, as on a links), tee boxes and green. The wind map draws them over the
// aerial imagery.
//
//   node scripts/golf-holes.mjs
//
// Only the resort's bounding box is sent, to the public Overpass service.
import { writeFileSync } from "node:fs";
import polygonClipping from "polygon-clipping";

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
  way["golf"~"^(hole|green|fairway|tee)$"](${BOX.join(",")});
  relation["golf"="fairway"](${BOX.join(",")});
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

// ---- Hole outlines, worked out in metres on a flat local grid ----
const K = Math.cos((43.195 * Math.PI) / 180) * 111320;
const M = 111320;
const toM = ([x, y]) => [x * K, y * M];
const toLL = ([x, y]) => [+(x / K).toFixed(5), +(y / M).toFixed(5)];
/** A closed ring of [x, y] in metres, or null when the way isn't closed. */
const ringM = (pts) => (pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1] ? pts.map(toM) : null);
/** Outer rings of a fairway: a closed way, or a multipolygon's closed outer members. */
const fairwayRings = (e) =>
  e.type === "way"
    ? [ringM(points(e))].filter(Boolean)
    : (e.members ?? []).filter((m) => m.role === "outer" && m.geometry).map((m) => ringM(m.geometry.map((p) => [p.lon, p.lat]))).filter(Boolean);
const fairways = elements.filter((e) => e.tags?.golf === "fairway").flatMap(fairwayRings);
const tees = elements.filter((e) => e.tags?.golf === "tee").map((e) => ringM(points(e))).filter(Boolean);
const greenRings = elements.filter((e) => e.tags?.golf === "green").map((e) => ringM(points(e))).filter(Boolean);

const insideM = inside;
/** A band `r` metres either side of a line (rounded at its ends and bends). */
const band = (line, r) => {
  const shapes = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * r;
    const ny = ((bx - ax) / len) * r;
    shapes.push([[[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny], [ax + nx, ay + ny]]]);
  }
  for (const [cx, cy] of line) {
    const ring = Array.from({ length: 17 }, (_, k) => [cx + r * Math.cos((k / 16) * 2 * Math.PI), cy + r * Math.sin((k / 16) * 2 * Math.PI)]);
    shapes.push([ring]);
  }
  return polygonClipping.union(...shapes);
};
/** Points every few metres along a line. */
const along = (line, step = 4) => {
  const out = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(line.at(-1));
  return out;
};
/** How far a point is from a line, and how far along the line (as a share of its length) it falls. */
const nearest = (line, [px, py]) => {
  let best = { d: Infinity, share: 0, at: line[0] };
  let run = 0;
  const total = line.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0) || 1;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len)));
    const d = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
    if (d < best.d) best = { d, share: (run + t * len) / total, at: [ax + t * (bx - ax), ay + t * (by - ay)] };
    run += len;
  }
  return best;
};
const centreM = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
/** Douglas-Peucker on a ring in metres. */
const thin = (pts, tolerance) => {
  if (pts.length < 4) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const d = ab === 0 ? Math.hypot(x - a[0], y - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1])) / ab;
    if (d > far) [far, at] = [d, i];
  }
  return far <= tolerance ? [a, b] : [...thin(pts.slice(0, at + 1), tolerance).slice(0, -1), ...thin(pts.slice(at), tolerance)];
};

/** How far either side of its line a hole's fairway is kept, where a fairway is shared. */
const REACH = 38;
/**
 * A hole's outline: the fairways its line runs through, trimmed to REACH metres either
 * side of the line; the tee boxes on its first stretch; its green; and a narrow spine along
 * the line that joins them where the hole carries over rough or dunes.
 */
function outlineOf(lineLL, greenLL) {
  const line = lineLL.map(toM);
  const walk = along(line);
  const crossed = fairways.filter((ring) => walk.some((p) => insideM(p, ring)));
  const parts = [band(line, 9)];
  if (crossed.length) parts.push(polygonClipping.intersection(polygonClipping.union(...crossed.map((r) => [r])), band(line, REACH)));
  for (const ring of tees) {
    const c = centreM(ring);
    const { d, share, at } = nearest(line, c);
    // A tee box beside the line joins it by a short strip, so the hole reads as one shape.
    if (d < 22 && share < 0.45) parts.push([ring], band([c, at], 6));
  }
  if (greenLL) {
    const g = greenRings.find((ring) => insideM(toM(lineLL.at(-1)), ring)) ?? greenLL.map(toM);
    parts.push([g]);
  }
  const shape = polygonClipping.union(...parts);
  return shape
    .map((polygon) => polygon.map((ring) => thin(ring, 1.8).map(toLL)).filter((ring) => ring.length >= 4))
    .filter((polygon) => polygon.length);
}

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
    outline: outlineOf(line, near && near.d < 45 ? near.g.ring : null),
  });
}
for (const course of Object.values(out)) course.holes.sort((a, b) => a.n - b.n);

writeFileSync("src/lib/holes.json", JSON.stringify(out) + "\n");
for (const [id, c] of Object.entries(out)) {
  const nums = c.holes.map((h) => h.n);
  const missing = Array.from({ length: Math.max(0, ...nums) }, (_, i) => i + 1).filter((n) => !nums.includes(n));
  console.log(`${id}: ${c.holes.length} holes, ${c.holes.filter((h) => h.green).length} greens, outline pieces ${c.holes.map((h) => h.outline.length).join("")}${missing.length ? `, missing ${missing}` : ""}`);
}
if (unplaced.length) console.log(`not placed on a course: ${unplaced.join(", ")}`);
