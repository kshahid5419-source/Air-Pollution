import type { Config } from "@netlify/functions";
import {
  DEMO_LOCATIONS,
  GEOCODE_URL,
  HttpError,
  buildInsights,
  errorResponse,
  fetchAirQuality,
  fetchJSON,
  nearbyPoints,
  numParam,
  type Place,
} from "../lib/air.js";
import rights from "../lib/rights.json" with { type: "json" };

async function geocode(url: URL) {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 80) throw new HttpError(422, "Search text must be 2–80 characters");
  const params = new URLSearchParams({ name: q, count: "6", language: "en", format: "json" });
  const data = await fetchJSON(`${GEOCODE_URL}?${params}`, 15000, "Geocoding provider");
  return (data.results ?? []).map((x: any) => ({
    id: `geo-${x.id}`,
    name: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
    latitude: x.latitude,
    longitude: x.longitude,
  }));
}

async function hotspots(url: URL) {
  const latitude = numParam(url, "latitude", { min: -90, max: 90 });
  const longitude = numParam(url, "longitude", { min: -180, max: 180 });
  const name = (url.searchParams.get("name") || "Selected area").slice(0, 80);
  const useDemo = latitude === undefined || longitude === undefined;
  const places: Place[] = useDemo ? DEMO_LOCATIONS : nearbyPoints(latitude, longitude, name);

  const results = await Promise.all(
    places.map(async (place) => {
      try {
        const data = await fetchAirQuality(place.latitude, place.longitude, 1);
        const current = data.current as Record<string, number | undefined>;
        return {
          ...place,
          aqi: current.us_aqi ?? null,
          pm2_5: current.pm2_5 ?? null,
          pm10: current.pm10 ?? null,
          status: current.us_aqi != null ? "ok" : "no_data",
        };
      } catch (err) {
        return {
          ...place,
          aqi: null,
          pm2_5: null,
          pm10: null,
          status: "unavailable",
          error: err instanceof HttpError ? err.detail : String(err),
        };
      }
    }),
  );
  const ranked = results
    .filter((r) => typeof r.aqi === "number")
    .sort((a, b) => (b.aqi as number) - (a.aqi as number));
  return {
    locations: results,
    highest: ranked[0] ?? null,
    lowest: ranked[ranked.length - 1] ?? null,
    area: useDemo ? "Lahore (demo)" : name,
    note: "Comparisons use Open-Meteo/CAMS modeled grid estimates, not physical sensor readings.",
  };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  try {
    switch (url.pathname.replace(/\/+$/, "")) {
      case "/api/health":
        return Response.json({ status: "ok", service: "AirWatch AI", version: "2.0.0" });
      case "/api/locations":
        return Response.json(DEMO_LOCATIONS);
      case "/api/rights":
        return Response.json(rights);
      case "/api/geocode":
        return Response.json(await geocode(url));
      case "/api/air-quality": {
        const lat = numParam(url, "latitude", { required: true, min: -90, max: 90 })!;
        const lon = numParam(url, "longitude", { required: true, min: -180, max: 180 })!;
        const pastDays = numParam(url, "past_days", { min: 0, max: 5, fallback: 2 })!;
        return Response.json(await fetchAirQuality(lat, lon, Math.trunc(pastDays)));
      }
      case "/api/insights": {
        const lat = numParam(url, "latitude", { required: true, min: -90, max: 90 })!;
        const lon = numParam(url, "longitude", { required: true, min: -180, max: 180 })!;
        const data = await fetchAirQuality(lat, lon, 2);
        return Response.json(buildInsights(data.hourly));
      }
      case "/api/hotspots":
        return Response.json(await hotspots(url));
      default:
        return Response.json({ detail: "Not found" }, { status: 404 });
    }
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: [
    "/api/health",
    "/api/locations",
    "/api/rights",
    "/api/geocode",
    "/api/air-quality",
    "/api/insights",
    "/api/hotspots",
  ],
  method: "GET",
};
