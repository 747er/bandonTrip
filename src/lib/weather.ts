import "server-only";

// Forecasts come from Open-Meteo (open-meteo.com, CC BY 4.0). Only the trip's coordinates
// are sent. Days outside the forecast window simply have no entry: nothing is estimated.

export type WeatherKind = "clear" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

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

function describe(code: number): { kind: WeatherKind; label: string } {
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
