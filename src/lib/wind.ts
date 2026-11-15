import "server-only";
import { eachDay } from "./time";

// Hour-by-hour conditions for the trip's days, from Open-Meteo (open-meteo.com, CC BY 4.0,
// no API key). One request covers a grid of points around the trip (the wind field the
// map animates) plus the trip's own coordinates (the readout). Only coordinates are sent.
// Days outside the forecast window come back empty: nothing is estimated.

export type WindData = {
  /** Local wall-clock hours, "2026-11-19T10:00", one per hour across the trip */
  times: string[];
  /** Wind field: rows run south to north, columns west to east */
  grid: {
    lats: number[];
    lons: number[];
    /** Per hour, the eastward and northward wind in mph at each grid point (row-major) */
    u: number[][];
    v: number[][];
  };
  /** Conditions at the trip's own coordinates, per hour */
  point: {
    speed: number[];
    gust: number[];
    /** Degrees the wind blows FROM, clockwise from north */
    direction: number[];
    temp: number[];
    rainChance: (number | null)[];
    code: number[];
  };
  days: { date: string; sunrise: string; sunset: string }[];
};

const ROWS = 6;
const COLS = 6;
/** Half-size of the wind field around the trip, in degrees (about 28 km each way) */
const LAT_SPAN = 0.25;
const LON_SPAN = 0.35;

const spread = (centre: number, span: number, n: number) =>
  Array.from({ length: n }, (_, i) => +(centre - span + (2 * span * i) / (n - 1)).toFixed(4));

export async function getWind(trip: {
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  startDate: string;
  endDate: string;
}): Promise<WindData | null> {
  if (trip.latitude === null || trip.longitude === null) return null;
  const lats = spread(trip.latitude, LAT_SPAN, ROWS);
  const lons = spread(trip.longitude, LON_SPAN, COLS);
  // First location is the trip itself, then the grid row by row.
  const latitude = [trip.latitude, ...lats.flatMap((lat) => lons.map(() => lat))];
  const longitude = [trip.longitude, ...lats.flatMap(() => lons)];

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: latitude.join(","),
    longitude: longitude.join(","),
    hourly:
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability,weather_code",
    daily: "sunrise,sunset",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: trip.timezone,
    start_date: trip.startDate,
    end_date: trip.endDate,
  }).toString();

  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    type Location = {
      hourly: Record<string, (number | string | null)[]>;
      daily?: Record<string, string[]>;
    };
    const all = (await res.json()) as Location[];
    if (!Array.isArray(all) || all.length !== latitude.length) return null;
    const [here, ...cells] = all;
    const times = (here.hourly.time as string[]) ?? [];
    const num = (loc: Location, key: string, h: number) => Number(loc.hourly[key]?.[h] ?? 0);
    // A forecast that hasn't reached these days yet returns nulls: treat that as no data.
    if (times.length === 0 || here.hourly.wind_speed_10m?.every((x) => x === null)) return null;

    const u: number[][] = [];
    const v: number[][] = [];
    times.forEach((_, h) => {
      const uh: number[] = [];
      const vh: number[] = [];
      for (const cell of cells) {
        const speed = num(cell, "wind_speed_10m", h);
        const from = (num(cell, "wind_direction_10m", h) * Math.PI) / 180;
        uh.push(+(-speed * Math.sin(from)).toFixed(1));
        vh.push(+(-speed * Math.cos(from)).toFixed(1));
      }
      u.push(uh);
      v.push(vh);
    });

    const days = eachDay(trip.startDate, trip.endDate).flatMap((date) => {
      const i = here.daily?.time?.indexOf(date) ?? -1;
      const sunrise = here.daily?.sunrise?.[i];
      const sunset = here.daily?.sunset?.[i];
      return i >= 0 && sunrise && sunset ? [{ date, sunrise, sunset }] : [];
    });

    return {
      times,
      grid: { lats, lons, u, v },
      point: {
        speed: times.map((_, h) => Math.round(num(here, "wind_speed_10m", h))),
        gust: times.map((_, h) => Math.round(num(here, "wind_gusts_10m", h))),
        direction: times.map((_, h) => Math.round(num(here, "wind_direction_10m", h))),
        temp: times.map((_, h) => Math.round(num(here, "temperature_2m", h))),
        rainChance: times.map((_, h) => {
          const p = here.hourly.precipitation_probability?.[h];
          return p === null || p === undefined ? null : Math.round(Number(p));
        }),
        code: times.map((_, h) => num(here, "weather_code", h)),
      },
      days,
    };
  } catch {
    return null;
  }
}
