// Shared, client-safe helpers for reading the hourly wind data.

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 315 → "NW": the direction the wind blows from. */
export const compass = (degrees: number) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

/** "NW" → 315: the other way round. Unknown names read as north. */
export const degreesOf = (direction: string) => Math.max(0, COMPASS.indexOf(direction)) * 22.5;

/** Index of the hour containing a local date and "HH:MM" time, or -1 when it is not covered. */
export function hourIndex(times: string[], date: string, time: string): number {
  return times.indexOf(`${date}T${time.slice(0, 2)}:00`);
}

/** "2026-11-19T16:50" → minutes since the first hour in `times`. */
export function minutesFromStart(times: string[], local: string): number {
  const i = times.indexOf(`${local.slice(0, 13)}:00`);
  return i < 0 ? -1 : i * 60 + Number(local.slice(14, 16));
}

/** Colour for a wind speed in mph, as [r, g, b] 0-255: calm sea-mist through sand and copper to red. */
export const SPEED_STOPS: [number, [number, number, number]][] = [
  [0, [150, 205, 200]],
  [6, [238, 226, 196]],
  [12, [242, 205, 130]],
  [18, [226, 140, 78]],
  [25, [214, 78, 60]],
  [35, [170, 40, 90]],
];

export function speedColor(mph: number): [number, number, number] {
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    const [s1, c1] = SPEED_STOPS[i];
    if (mph <= s1) {
      const [s0, c0] = SPEED_STOPS[i - 1];
      const t = (mph - s0) / (s1 - s0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return SPEED_STOPS[SPEED_STOPS.length - 1][1];
}

/** Linear interpolation keeps readouts on the same fractional hour as the wind field. */
export function interpolate(values: number[], time: number): number {
  const t = Math.max(0, Math.min(values.length - 1, time));
  const a = Math.floor(t);
  return values[a] + (values[Math.min(a + 1, values.length - 1)] - values[a]) * (t - a);
}

/** Interpolate through north along the shortest arc, never spinning through south. */
export function interpolateDirection(values: number[], time: number): number {
  const t = Math.max(0, Math.min(values.length - 1, time));
  const a = Math.floor(t);
  const delta = ((values[Math.min(a + 1, values.length - 1)] - values[a] + 540) % 360) - 180;
  return (values[a] + delta * (t - a) + 360) % 360;
}

/** Course and schedule briefings use the same minute-level forecast as the map. */
export type ForecastAt = { temp: number; speed: number; gust: number; direction: string };

/** The forecast at one moment, rounded for display. */
export function forecastAt(point: { temp: number[]; speed: number[]; gust: number[]; direction: number[] }, time: number): ForecastAt {
  return {
    temp: Math.round(interpolate(point.temp, time)),
    speed: Math.round(interpolate(point.speed, time)),
    gust: Math.round(interpolate(point.gust, time)),
    direction: compass(interpolateDirection(point.direction, time)),
  };
}

export function forecastSummary(point: { temp: number[]; speed: number[]; gust: number[]; direction: number[] }, time: number): string {
  const { temp, speed, gust, direction } = forecastAt(point, time);
  return `${temp}°, wind ${speed} mph from the ${direction}${gust > speed ? `, gusts ${gust}` : ""}`;
}

export function timelineLocal(times: string[], time: number): string {
  const minute = Math.max(0, Math.min((times.length - 1) * 60, Math.round(time * 60)));
  return `${times[Math.floor(minute / 60)].slice(0, 14)}${String(minute % 60).padStart(2, "0")}`;
}

export function timelineLabel(times: string[], time: number): string {
  return new Intl.DateTimeFormat("en-US", {weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "UTC"}).format(new Date(`${timelineLocal(times, time)}Z`));
}

/** Degrees clockwise from north that a hole plays toward, from its tee to its green. */
export function heading(line: [number, number][]): number {
  const [x1, y1] = line[0];
  const [x2, y2] = line[line.length - 1];
  const east = (x2 - x1) * Math.cos((y1 * Math.PI) / 180);
  const north = y2 - y1;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/**
 * How the wind plays on a hole whose line of play (tee to green, as [longitude,
 * latitude]) is `line`, the way golfers say it: "Into the wind", "Downwind",
 * "Left to right", or a mix such as "Into, right to left". `from` is where the wind
 * blows from, in degrees.
 */
export function windOnHole(line: [number, number][], from: number): string {
  // Angle between the way the wind blows and the way the hole plays: 0 is straight
  // behind the player, 180 straight in their face, positive toward their right.
  const a = ((((from + 180 - heading(line)) % 360) + 540) % 360) - 180;
  const across = a > 0 ? "Left to right" : "Right to left";
  const off = Math.abs(a);
  if (off <= 25) return "Downwind";
  if (off >= 155) return "Into the wind";
  if (off < 65) return `Helping, ${across.toLowerCase()}`;
  if (off > 115) return `Into, ${across.toLowerCase()}`;
  return across;
}
