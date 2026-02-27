"""
weather.py — OpenWeatherMap API client for temperature + humidity.
"""

import os

import httpx

API_KEY = os.environ.get("OPENWEATHERMAP_API_KEY", "")
GEO_URL = "http://api.openweathermap.org/geo/1.0/direct"
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"


async def geocode_region(city_or_pincode: str) -> tuple[float, float] | None:
    """Convert a city name or pincode to (latitude, longitude)."""
    if not API_KEY:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(GEO_URL, params={"q": city_or_pincode, "limit": 1, "appid": API_KEY})
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return (data[0]["lat"], data[0]["lon"])
    return None


async def get_current_weather(lat: float, lon: float) -> dict:
    """Fetch current air_temperature (C) and humidity (%) from OpenWeatherMap."""
    if not API_KEY:
        # Fallback for development without API key
        return {"air_temperature": 25.0, "humidity": 60.0}
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            WEATHER_URL,
            params={"lat": lat, "lon": lon, "appid": API_KEY, "units": "metric"},
        )
        data = resp.json()
        try:
            return {
                "air_temperature": data["main"]["temp"],
                "humidity": data["main"]["humidity"],
            }
        except (KeyError, TypeError):
            # API returned an error response — fall back to defaults
            return {"air_temperature": 25.0, "humidity": 60.0}
