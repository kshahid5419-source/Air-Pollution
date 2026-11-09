import httpx
from fastapi import HTTPException

URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

async def fetch_air_quality(latitude: float, longitude: float, past_days: int = 2):
    params = {
        "latitude": latitude, "longitude": longitude,
        "current": "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
        "hourly": "us_aqi,pm2_5,pm10",
        "past_days": max(0, min(past_days, 5)), "forecast_days": 2,
        "timezone": "auto"
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(URL, params=params)
            response.raise_for_status()
            data = response.json()
            return {
                "source": "Open-Meteo / CAMS model data",
                "latitude": latitude, "longitude": longitude,
                "current": data.get("current", {}),
                "hourly": data.get("hourly", {}),
                "hourly_units": data.get("hourly_units", {}),
                "timezone": data.get("timezone"),
                "note": "Modeled grid estimate, not a street-level sensor measurement."
            }
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Air-quality provider unavailable: {exc}")
