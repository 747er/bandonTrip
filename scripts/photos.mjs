// Lists the files under public/images so the app knows which photo slots are filled.
// Runs before dev and build; in development the folders are also read live.
import { createHash } from "node:crypto";
import { readdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const dir = "public/images";
const files = existsSync(dir)
  ? readdirSync(dir, { recursive: true })
      .map((f) => String(f).replaceAll("\\", "/"))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      // A short content hash, so a replaced photo gets a new address and is never served stale.
      .map((f) => `${f}?v=${createHash("sha1").update(readFileSync(`${dir}/${f}`)).digest("hex").slice(0, 10)}`)
  : [];
let meta = {};
try {
  meta = JSON.parse(readFileSync(`${dir}/images.json`, "utf8"));
} catch {}
writeFileSync("src/lib/photos.generated.json", JSON.stringify({ files, meta }, null, 2) + "\n");
console.log(`[images] ${files.length} photo(s) found in ${dir}`);
