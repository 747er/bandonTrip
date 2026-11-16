// Open-Meteo's WMO weather codes, read as the site's weather glyphs. Client-safe.

export type WeatherKind = "clear" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function describe(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: "clear", label: "Clear" };
  if (code === 1) return { kind: "partly", label: "Mostly clear" };
  if (code === 2) return { kind: "partly", label: "Partly cloudy" };
  if (code === 3) return { kind: "cloud", label: "Overcast" };
  if (code === 45 || code === 48) return { kind: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { kind: "drizzle", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { kind: "rain", label: code >= 65 ? "Heavy rain" : "Rain" };
  if (code >= 71 && code <= 77) return { kind: "snow", label: "Snow" };
  if (code >= 80 && code <= 82) return { kind: "rain", label: "Showers" };
  if (code >= 85 && code <= 86) return { kind: "snow", label: "Snow showers" };
  if (code >= 95) return { kind: "storm", label: "Thunderstorms" };
  return { kind: "cloud", label: "Cloudy" };
}
