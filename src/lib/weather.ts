import "server-only";
import { describe, type WeatherKind } from "./weatherCodes";

export type { WeatherKind };

// Forecasts come from Open-Meteo (open-meteo.com, CC BY 4.0). Only the trip's coordinates
// are sent. Days outside the forecast window simply have no entry: nothing is estimated.

export type DayWeather = {
  date: string;
  kind: WeatherKind;
  label: string;
  high: number;
  low: number;
  /** Sustained wind, mph */
  wind: number;
  /** Where the day's wind mostly blows from, in degrees. Null when not forecast. */
  windFrom: number | null;
  /** Peak gust, mph. Null when the forecast has none above the sustained wind. */
  gust: number | null;
  /** Chance of rain, percent. Null when the model doesn't provide it that far out. */
  rainChance: number | null;
};

/** A gust figure is only worth showing when it exceeds the sustained wind. */
function gustAbove(gust: unknown, wind: unknown): number | null {
  const g = Math.round(Number(gust ?? 0));
  return g > Math.round(Number(wind ?? 0)) ? g : null;
}


export async function getForecast(trip: {
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}): Promise<Record<string, DayWeather>> {
  if (trip.latitude === null || trip.longitude === null) return {};
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(trip.latitude),
    longitude: String(trip.longitude),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: trip.timezone,
    forecast_days: "16",
  }).toString();

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return {};
    const { daily } = (await res.json()) as {
      daily?: Record<string, (number | string | null)[]>;
    };
    if (!daily?.time) return {};
    const out: Record<string, DayWeather> = {};
    daily.time.forEach((date, i) => {
      const code = daily.weather_code?.[i];
      const high = daily.temperature_2m_max?.[i];
      const low = daily.temperature_2m_min?.[i];
      if (typeof code !== "number" || typeof high !== "number" || typeof low !== "number") return;
      const rain = daily.precipitation_probability_max?.[i];
      const from = daily.wind_direction_10m_dominant?.[i];
      out[String(date)] = {
        date: String(date),
        ...describe(code),
        high: Math.round(high),
        low: Math.round(low),
        wind: Math.round(Number(daily.wind_speed_10m_max?.[i] ?? 0)),
        windFrom: typeof from === "number" ? from : null,
        gust: gustAbove(daily.wind_gusts_10m_max?.[i], daily.wind_speed_10m_max?.[i]),
        rainChance: typeof rain === "number" ? Math.round(rain) : null,
      };
    });
    return out;
  } catch {
    return {};
  }
}
