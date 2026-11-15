// Builds the tab and home-screen icons from src/app/icon.svg.
// Run `node scripts/icons.mjs` after changing the drawing.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("src/app/icon.svg", "utf8");
const png = (source, size) => sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toBuffer();

// iOS rounds the corners itself, so its icon is a full square.
writeFileSync("src/app/apple-icon.png", await png(svg.replace('rx="14"', 'rx="0"'), 180));

// favicon.ico: a small directory of PNGs, for browsers that ask for it by name.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(svg, s)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(size, at);
  header.writeUInt8(size, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...images]));
console.log("wrote apple-icon.png and favicon.ico");
