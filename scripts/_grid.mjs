const lat0 = 43.188, lon0 = -124.39, R = 6, C = 6;
const spread = (c, s, n) => Array.from({ length: n }, (_, i) => +(c - s + (2 * s * i) / (n - 1)).toFixed(4));
const lats = spread(lat0, 0.25, R), lons = spread(lon0, 0.35, C);
const latitude = lats.flatMap((la) => lons.map(() => la)), longitude = lats.flatMap(() => lons);
const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.join(",")}&longitude=${longitude.join(",")}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&timezone=America%2FLos_Angeles&start_date=2026-11-19&end_date=2026-11-22`;
const all = await (await fetch(url)).json();
console.log("locations", all.length);
for (const h of [10, 38, 60]) {
  console.log("hour", all[0].hourly.time[h]);
  for (let r = R - 1; r >= 0; r--) {
    console.log(lats[r].toFixed(2), lons.map((_, c) => { const x = all[r * C + c]; return `${String(Math.round(x.hourly.wind_speed_10m[h])).padStart(2)}@${String(x.hourly.wind_direction_10m[h]).padStart(3)}`; }).join("  "));
  }
}
console.log("returned coords row 3:", lons.map((_, c) => `${all[3 * C + c].latitude.toFixed(2)},${all[3 * C + c].longitude.toFixed(2)} el ${all[3 * C + c].elevation}`).join(" | "));
