// Shared helpers for the AirWatch AI API (ported from the original FastAPI backend).

export class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

export const errorResponse = (err: unknown) => {
  if (err instanceof HttpError) {
    return Response.json({ detail: err.detail }, { status: err.status });
  }
  console.error(err);
  return Response.json({ detail: "Internal server error" }, { status: 500 });
};

/** Parse a numeric query parameter with optional bounds; returns undefined if absent and not required. */
export function numParam(
  url: URL,
  name: string,
  opts: { required?: boolean; min?: number; max?: number; fallback?: number } = {},
): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") {
    if (opts.required) throw new HttpError(422, `Query parameter '${name}' is required`);
    return opts.fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new HttpError(422, `Query parameter '${name}' must be a number`);
  if (opts.min !== undefined && value < opts.min) throw new HttpError(422, `'${name}' must be >= ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) throw new HttpError(422, `'${name}' must be <= ${opts.max}`);
  return value;
}

export const DEMO_LOCATIONS = [
  { id: "central", name: "Lahore Central", latitude: 31.5204, longitude: 74.3587 },
  { id: "gulberg", name: "Gulberg", latitude: 31.51, longitude: 74.344 },
  { id: "model-town", name: "Model Town", latitude: 31.483, longitude: 74.326 },
  { id: "dha", name: "DHA", latitude: 31.469, longitude: 74.41 },
  { id: "shahdara", name: "Shahdara", latitude: 31.617, longitude: 74.286 },
  { id: "badami-bagh", name: "Badami Bagh", latitude: 31.589, longitude: 74.342 },
];

export type Place = { id: string; name: string; latitude: number; longitude: number };

const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
export const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function fetchJSON(url: string, timeoutMs: number, providerLabel: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    throw new HttpError(502, `${providerLabel} unavailable: ${(err as Error).message}`);
  }
}

export async function fetchAirQuality(latitude: number, longitude: number, pastDays = 2) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
    hourly: "us_aqi,pm2_5,pm10",
    past_days: String(Math.max(0, Math.min(pastDays, 5))),
    forecast_days: "2",
    timezone: "auto",
  });
  const data = await fetchJSON(`${AIR_URL}?${params}`, 20000, "Air-quality provider");
  return {
    source: "Open-Meteo / CAMS model data",
    latitude,
    longitude,
    current: data.current ?? {},
    hourly: data.hourly ?? {},
    hourly_units: data.hourly_units ?? {},
    timezone: data.timezone ?? null,
    note: "Modeled grid estimate, not a street-level sensor measurement.",
  };
}

export function nearbyPoints(latitude: number, longitude: number, label: string): Place[] {
  const dLat = 0.065;
  const dLon = 0.065 / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const offsets: [string, string, number, number][] = [
    ["centre", label, 0, 0],
    ["north", "North of centre", dLat, 0],
    ["south", "South of centre", -dLat, 0],
    ["east", "East of centre", 0, dLon],
    ["west", "West of centre", 0, -dLon],
    ["northeast", "North-east of centre", dLat, dLon],
  ];
  const round4 = (n: number) => Math.round(n * 10000) / 10000;
  return offsets.map(([id, name, dy, dx]) => {
    const lat = Math.max(-90, Math.min(90, latitude + dy));
    const lon = ((((longitude + dx + 180) % 360) + 360) % 360) - 180;
    return { id, name, latitude: round4(lat), longitude: round4(lon) };
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildInsights(hourly: { time?: string[]; us_aqi?: (number | null)[] }) {
  const times = hourly.time ?? [];
  const values = hourly.us_aqi ?? [];
  const valid: number[] = [];
  for (let i = 0; i < Math.min(times.length, values.length); i++) {
    const v = values[i];
    if (typeof v === "number" && Number.isFinite(v)) valid.push(v);
  }
  if (!valid.length) {
    return {
      summary: "Not enough air-quality data to generate an insight.",
      anomaly: false,
      prediction: null,
      confidence: "insufficient data",
    };
  }
  const recent = valid.slice(-6);
  const baseline = valid.slice(-24, -6);
  const recentAvg = mean(recent);
  const baselineAvg = baseline.length ? mean(baseline) : recentAvg;
  const latest = valid[valid.length - 1];
  const anomaly = baseline.length > 0 && recentAvg > baselineAvg * 1.35 && recentAvg - baselineAvg >= 15;
  let summary = `Latest available modeled US AQI is ${Math.round(latest)}. `;
  if (anomaly) {
    summary += "Recent values are notably above the preceding baseline. Check local conditions and community reports.";
  } else if (recentAvg > 100) {
    summary += "Recent values are elevated. Sensitive groups should follow local public-health guidance.";
  } else {
    summary += "Recent values are relatively stable compared with the preceding available hours.";
  }
  return {
    summary,
    anomaly,
    recent_average: round1(recentAvg),
    baseline_average: round1(baselineAvg),
    prediction: round1(recentAvg),
    prediction_label: "simple baseline estimate, not a validated forecast",
    confidence: "low; based on available model series",
  };
}
