// Builds the aerial base map for the resort from USDA NAIP imagery (public domain),
// fetched from the USGS National Map image service. No API key.
//
//   node scripts/build-tiles.mjs
//
// Writes public/tiles/naip/{z}/{x}/{y}.webp for zooms 12-18 over the area below.
// Source chunks are cached in .data/tile-cache, so a re-run only fetches what is missing.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import sharp from "sharp";

// The area, as z15 tiles (each about 900 m across here). Covers Sheep Ranch in the
// north to Shorty's in the south, and the beach to the highway side of the cottages.
const Z15 = { x0: 5059, x1: 5063, y0: 12012, y1: 12019 };
const SERVICE = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";
const CACHE = ".data/tile-cache";
const OUT = "public/tiles/naip";
const HALF = 20037508.342789244;
const QUALITY = 72;

mkdirSync(CACHE, { recursive: true });

async function chunk(x, y) {
  const file = `${CACHE}/15-${x}-${y}.jpg`;
  if (existsSync(file)) return readFileSync(file);
  const res = (HALF * 2) / 2 ** 15;
  const bbox = [-HALF + x * res, HALF - (y + 1) * res, -HALF + (x + 1) * res, HALF - y * res].join(",");
  const url = `${SERVICE}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=2048,2048&format=jpg&interpolation=RSP_BilinearInterpolation&f=image`;
  for (let attempt = 1; attempt <= 8; attempt++) {
    // The service is slow and sheds load with 502s: wait longer after each miss.
    if (attempt > 1) await new Promise((r) => setTimeout(r, attempt * 8000));
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      const body = Buffer.from(await r.arrayBuffer());
      if (r.ok && body.length > 20_000 && body[0] === 0xff) {
        writeFileSync(file, body);
        return body;
      }
      console.log(`  retry ${x},${y}: status ${r.status}, ${body.length} bytes`);
    } catch (e) {
      console.log(`  retry ${x},${y}: ${e.message}`);
    }
  }
  throw new Error(`could not fetch chunk ${x},${y}`);
}

async function write(z, x, y, image) {
  mkdirSync(`${OUT}/${z}/${x}`, { recursive: true });
  await image.webp({ quality: QUALITY }).toFile(`${OUT}/${z}/${x}/${y}.webp`);
}

// One 2048 px chunk is exactly one z15 tile, 2x2 z16, 4x4 z17 and 8x8 z18 tiles.
async function slice(x, y, body) {
  for (const [z, n] of [[18, 8], [17, 4], [16, 2], [15, 1]]) {
    const size = 256 * n;
    const level = size === 2048 ? body : await sharp(body).resize(size, size, { kernel: "lanczos3" }).jpeg({ quality: 95 }).toBuffer();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        await write(z, x * n + i, y * n + j, sharp(level).extract({ left: i * 256, top: j * 256, width: 256, height: 256 }));
      }
    }
  }
}

const jobs = [];
for (let y = Z15.y0; y <= Z15.y1; y++) for (let x = Z15.x0; x <= Z15.x1; x++) jobs.push([x, y]);
let done = 0;
async function worker() {
  while (jobs.length) {
    const [x, y] = jobs.shift();
    await slice(x, y, await chunk(x, y));
    console.log(`[tiles] ${++done} chunks done (${x},${y})`);
  }
}
await Promise.all([worker(), worker()]);

// Zooms 12-14: stitch the z15 tiles and cut again. Tiles that reach past the area keep
// a transparent edge, so the wide-area basemap shows through.
for (const z of [14, 13, 12]) {
  const f = 2 ** (15 - z);
  for (let ty = Math.floor(Z15.y0 / f); ty <= Math.floor(Z15.y1 / f); ty++) {
    for (let tx = Math.floor(Z15.x0 / f); tx <= Math.floor(Z15.x1 / f); tx++) {
      const parts = [];
      const cell = 256 / f;
      for (let j = 0; j < f; j++) {
        for (let i = 0; i < f; i++) {
          const src = `${OUT}/15/${tx * f + i}/${ty * f + j}.webp`;
          if (!existsSync(src)) continue;
          parts.push({ input: await sharp(src).resize(cell, cell).png().toBuffer(), left: i * cell, top: j * cell });
        }
      }
      if (parts.length === 0) continue;
      const canvas = sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
      await write(z, tx, ty, sharp(await canvas.composite(parts).png().toBuffer()));
    }
  }
}
console.log("[tiles] finished");
