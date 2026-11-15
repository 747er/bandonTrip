// Builds public/images/map/resort.jpg from the clean resort map in scripts/map: crops
// off the legend and the page margins, and saves it small. Run with
// `node scripts/clean-map.mjs`. Pin positions in src/lib/resortMap.ts are pixels on the
// image this writes, so change them together with CROP.
import sharp from "sharp";

const SOURCE = "scripts/map/resort-source.png";
const OUT = "public/images/map/resort.jpg";
const CROP = { left: 23, top: 19, width: 1045, height: 1173 };

const info = await sharp(SOURCE).extract(CROP).jpeg({ quality: 84, mozjpeg: true }).toFile(OUT);
console.log(`[map] wrote ${OUT}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
