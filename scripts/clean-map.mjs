// Builds public/images/map/resort.jpg from the resort's printed map: crops to the map
// area and paints out the printed clubhouse stars, numbered dots, logo arrows and dashed inset box, so the only markers
// on the schedule map are our own. Run with `node scripts/clean-map.mjs`.
import sharp from "sharp";

const SOURCE = "scripts/map/resort-source.webp";
const OUT = "public/images/map/resort.jpg";
const CROP = { left: 32, top: 30, width: 1483, height: 1668 };

// Printed markers to remove: [x, y, radius] in cropped-image pixels.
const MARKS = [
  // clubhouse stars 1-6
  [713, 177, 32], [804, 690, 32], [731, 960, 32], [657, 1101, 32], [645, 1236, 32], [626, 1524, 32],
  // numbered dots 7-20
  [662, 1140, 20], [697, 1161, 20], [721, 1185, 20], [741, 1245, 20], [855, 1190, 20], [878, 1133, 20],
  [706, 1110, 20], [700, 1079, 20], [720, 1050, 20], [807, 1067, 20], [810, 866, 20], [841, 642, 20],
  [979, 1076, 20], [869, 1045, 20],
];

// The printed note pointing at the map's reverse side: [left, top, right, bottom].
const BOXES = [[940, 856, 1046, 880]];

const { data, info } = await sharp(SOURCE).extract(CROP).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const mask = new Uint8Array(W * H);
for (const [cx, cy, r] of MARKS) {
  for (let y = Math.max(1, cy - r); y <= Math.min(H - 2, cy + r); y++) {
    for (let x = Math.max(1, cx - r); x <= Math.min(W - 2, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * W + x] = 1;
    }
  }
}
for (const [x0, y0, x1, y1] of BOXES) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * W + x] = 1;
}
// Printed lines are found by colour inside a narrow search area, so only the ink is
// painted out and whatever they cross (roads, course outlines) is left alone.
const rgb = (x, y) => [data[(y * W + x) * C], data[(y * W + x) * C + 1], data[(y * W + x) * C + 2]];
const isWhite = (x, y) => Math.min(...rgb(x, y)) > 215;
const isGreyInk = (x, y) => {
  const [r, g, b] = rgb(x, y);
  return r > 55 && r < 175 && Math.abs(r - g) < 20 && Math.abs(g - b) < 24;
};
const ink = new Uint8Array(W * H);
const scan = (x0, y0, x1, y1, test) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(x, y)) ink[y * W + x] = 1;
};

// The white arrows running in from the course logos: [row, x where the arrowhead ends].
const ARROWS = [[273, 655], [551, 765], [753, 645], [937, 700], [1109, 590], [1266, 565], [1395, 760], [1536, 590]];
for (const [y, end] of ARROWS) {
  scan(238, y - 4, end - 50, y + 4, isWhite); // shaft
  scan(end - 50, y - 19, end, y + 19, isWhite); // head
}

// The dashed rectangle marking the area shown on the map's reverse side.
const BOX = { left: 620, right: 1126, top: 849, bottom: 1313 };
scan(BOX.left - 6, BOX.top - 6, BOX.left + 6, BOX.bottom + 6, isGreyInk);
scan(BOX.right - 6, BOX.top - 6, BOX.right + 6, BOX.bottom + 6, isGreyInk);
scan(BOX.left - 6, BOX.top - 6, BOX.right + 6, BOX.top + 6, isGreyInk);
scan(BOX.left - 6, BOX.bottom - 6, BOX.right + 6, BOX.bottom + 6, isGreyInk);

// Widen the found ink by a few pixels to take its soft edges with it.
const GROW = 3;
for (let y = GROW; y < H - GROW; y++) {
  for (let x = GROW; x < W - GROW; x++) {
    if (!ink[y * W + x]) continue;
    for (let dy = -GROW; dy <= GROW; dy++) for (let dx = -GROW; dx <= GROW; dx++) mask[(y + dy) * W + x + dx] = 1;
  }
}

const holes = [];
for (let i = 0; i < mask.length; i++) if (mask[i]) holes.push(i);

// Fill each hole from its edges inward: repeatedly set every masked pixel to the average
// of its neighbours until the surrounding colour has flowed all the way across.
const px = Float32Array.from(data);
for (let pass = 0; pass < 900; pass++) {
  for (const i of holes) {
    const p = i * C;
    for (let c = 0; c < C; c++) {
      px[p + c] = (px[p - C + c] + px[p + C + c] + px[p - W * C + c] + px[p + W * C + c]) / 4;
    }
  }
}
// A little grain, so the patches don't read as smoother than the paper around them.
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5);
for (const i of holes) {
  const n = rand() * 7;
  for (let c = 0; c < C; c++) px[i * C + c] += n;
}

const out = Buffer.from(Uint8ClampedArray.from(px));
await sharp(out, { raw: { width: W, height: H, channels: C } }).jpeg({ quality: 88 }).toFile(OUT);
console.log(`[map] wrote ${OUT}: ${MARKS.length} markers, ${ARROWS.length} arrows and the inset box removed`);
