// The resort from above, shared by the wind map and the hole flyover: wide-area imagery,
// our own sharper aerial tiles over the resort, and open sea fading in past the shore.
// Browser only (the sea is painted on a canvas).

import type { StyleSpecification } from "maplibre-gl";
import coast from "@/lib/coast.json";

/** The shoreline as [latitude, longitude], south to north (scripts/trace-coast.mjs) */
export const COAST = coast as [number, number][];

// The aerial tiles we host cover these z15 tiles (see scripts/build-tiles.mjs).
const Z15 = { x0: 5059, x1: 5063, y0: 12012, y1: 12019 };
const lonOf = (x: number) => (x / 2 ** 15) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** 15))) * 180) / Math.PI;
export const NAIP_BOUNDS: [number, number, number, number] = [lonOf(Z15.x0), latOf(Z15.y1 + 1), lonOf(Z15.x1 + 1), latOf(Z15.y0)];

// Our aerial tiles are darker and flatter than the wide-area imagery around them (about
// 0.62 of its brightness, measured on matching tiles), so each is set to meet the other.
// Both are dimmed a little, so the wind and the dark panels read over the ground.
const NAIP_PAINT = { "raster-brightness-max": 0.72, "raster-saturation": 0.04, "raster-contrast": 0.04, "raster-fade-duration": 200 };
const WIDE_PAINT = { "raster-brightness-max": 0.46, "raster-saturation": -0.05, "raster-fade-duration": 200 };

/** Deep Pacific: the open sea past the imagery, and the ground under the map. */
export const OCEAN: [number, number, number] = [18, 46, 54];
export const OCEAN_HEX = `#${OCEAN.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/**
 * A picture of "open ocean": transparent over land and the surf, fading to the map's
 * background colour a little way offshore. Laid over the imagery, it hides the ragged
 * line out at sea where the aerial coverage stops.
 */
export const SEA = { west: -125.3, east: -124.0, south: COAST[0][0], north: COAST[COAST.length - 1][0] };
export function seaFade(): string {
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

/** The map style: the ground, the wide imagery, our aerial tiles and the sea over them. */
export function aerialStyle(): StyleSpecification {
  return {
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
  };
}
