// Finds where the ocean meets the land at a run of latitudes, from Open-Meteo's public
// elevation service (no key), and writes src/lib/coast.json. The wind map uses it to
// fade the aerial imagery out over open water, where its coverage ends in a ragged edge.
//
//   node scripts/trace-coast.mjs
import { writeFileSync } from "node:fs";

const SOUTH = 42.6;
const NORTH = 43.8;
const STEP = 0.05;
const lats = [];
for (let lat = SOUTH; lat <= NORTH + 1e-9; lat += STEP) lats.push(+lat.toFixed(3));

async function elevations(points) {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p[0]).join(",")}&longitude=${points.map((p) => p[1].toFixed(5)).join(",")}`;
  // The service is rate limited: go gently, and wait it out when told to.
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 20000));
    const res = await fetch(url);
    if (res.ok) return (await res.json()).elevation;
    if (res.status !== 429) throw new Error(`elevation service: ${res.status}`);
  }
  throw new Error("elevation service kept refusing");
}

// Walk east from open ocean in coarse steps to the first land, then bisect that step.
// (Walking from the west finds the outer coast, not a bay or river mouth behind it.)
const WEST = -124.75;
const COARSE = 0.04;
const firstLand = lats.map(() => null);
for (let k = 0; k < 20 && firstLand.some((x) => x === null); k++) {
  const todo = lats.map((lat, i) => [lat, WEST + k * COARSE, i]).filter(([, , i]) => firstLand[i] === null);
  const elev = await elevations(todo);
  todo.forEach(([, lon, i], n) => {
    if (elev[n] > 0.5) firstLand[i] = lon;
  });
}
let lo = firstLand.map((lon) => (lon ?? WEST + 20 * COARSE) - COARSE);
let hi = firstLand.map((lon) => lon ?? WEST + 20 * COARSE);
for (let step = 0; step < 7; step++) {
  const mid = lo.map((a, i) => (a + hi[i]) / 2);
  const elev = await elevations(lats.map((lat, i) => [lat, mid[i]]));
  elev.forEach((e, i) => (e > 0.5 ? (hi[i] = mid[i]) : (lo[i] = mid[i])));
}
const coast = lats.map((lat, i) => [lat, +((lo[i] + hi[i]) / 2).toFixed(4)]);
writeFileSync("src/lib/coast.json", JSON.stringify(coast) + "\n");
console.log(coast.map(([lat, lon]) => `${lat} ${lon}`).join("\n"));
