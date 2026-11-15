// Shared, client-safe helpers for reading the hourly wind data.

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** 315 → "NW": the direction the wind blows from. */
export const compass = (degrees: number) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

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
  [6, [233, 231, 224]],
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
