// Builds the picture shown when a link to the site is shared: the Broken Top logo over
// the cover photo. Run `node scripts/og-image.mjs` after changing either file.
import sharp from "sharp";

const W = 1200, H = 630;
const LOGO_W = 900;

const photo = await sharp("public/images/hero/bandon-coast.jpg")
  .resize(W, H, { fit: "cover", position: "centre" })
  .toBuffer();
// A soft forest shade, deepest behind the logo, so white lettering holds over sky and surf.
const shade = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="62%">
      <stop offset="0" stop-color="#0d211b" stop-opacity=".62"/>
      <stop offset="1" stop-color="#0d211b" stop-opacity=".3"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`,
);
const logo = await sharp("public/images/BrokenTopLogo.png").resize({ width: LOGO_W }).toBuffer();
const { height: logoH } = await sharp(logo).metadata();

for (const out of ["src/app/opengraph-image.jpg", "src/app/twitter-image.jpg"]) {
  const info = await sharp(photo)
    .composite([
      { input: shade },
      { input: logo, left: Math.round((W - LOGO_W) / 2), top: Math.round((H - logoH) / 2) },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(out);
  console.log(out, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
