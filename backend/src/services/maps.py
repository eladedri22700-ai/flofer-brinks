"""Google Maps Platform proxy (Places New + Geocoding).

Fallback chain: Google -> free OpenStreetMap (Photon / Nominatim) -> mock.
A Google failure (e.g. billing disabled, quota) opens a short circuit breaker
so the crew is not kept waiting on a provider that is known to be down.
"""

from __future__ import annotations

import logging
import time as _time

import httpx

from src.core.config import get_settings
from src.core.exceptions import AppError
from src.services import free_geo, maps_mock

logger = logging.getLogger(__name__)

CONFIDENCE_BY_TYPE = {
    "ROOFTOP": 1.0,
    "RANGE_INTERPOLATED": 0.7,
    "GEOMETRIC_CENTER": 0.5,
    "APPROXIMATE": 0.3,
}

GOOGLE_COOLDOWN_S = 600.0
_google_down_until = 0.0


def google_ready() -> bool:
    return get_settings().maps_live and _time.monotonic() >= _google_down_until


def mark_google_failed(reason: str) -> None:
    global _google_down_until
    _google_down_until = _time.monotonic() + GOOGLE_COOLDOWN_S
    logger.warning("Google Maps unavailable (%s) — using free fallback for %ss", reason, int(GOOGLE_COOLDOWN_S))


def _free_enabled() -> bool:
    return get_settings().free_geo


async def autocomplete(query: str, *, lat: float | None = None, lng: float | None = None) -> list[dict]:
    if google_ready():
        try:
            return await _google_autocomplete(query, lat=lat, lng=lng)
        except AppError:
            mark_google_failed("autocomplete")
    if _free_enabled():
        try:
            found = await free_geo.autocomplete(query, lat=lat, lng=lng)
            if found:
                return found
        except free_geo.FreeGeoError as exc:
            logger.warning("Free autocomplete failed: %s", exc)
    return maps_mock.autocomplete(query)


async def _google_autocomplete(
    query: str, *, lat: float | None = None, lng: float | None = None
) -> list[dict]:
    settings = get_settings()

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_server_key,
    }
    body: dict = {
        "input": query,
        "languageCode": "he",
        "regionCode": "IL",
    }
    if lat is not None and lng is not None:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 30000.0,
            }
        }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://places.googleapis.com/v1/places:autocomplete",
                headers={**headers, "X-Goog-FieldMask": "suggestions.placePrediction"},
                json=body,
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        logger.exception("Places autocomplete failed: %s", exc)
        raise AppError(
            code="maps_error",
            message_he="שגיאה בחיפוש כתובות. בדקו את מפתח Google או נסו שוב.",
            status_code=502,
        ) from exc

    out: list[dict] = []
    for sug in data.get("suggestions", []):
        pred = sug.get("placePrediction") or {}
        place_id = pred.get("placeId")
        text = (pred.get("text") or {}).get("text") or ""
        if place_id and text:
            out.append({"place_id": place_id, "description": text})
    return out


async def place_details(place_id: str) -> dict:
    settings = get_settings()
    osm = free_geo.decode_place_id(place_id)
    if osm is not None:
        return osm
    if place_id.startswith("mock_") or not settings.maps_live:
        details = maps_mock.place_details(place_id)
        if details is None:
            raise AppError(code="place_not_found", message_he="המקום לא נמצא", status_code=404)
        return details

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_server_key,
        "X-Goog-FieldMask": "formattedAddress,location",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                headers=headers,
                params={"languageCode": "he", "regionCode": "IL"},
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        logger.exception("Place details failed: %s", exc)
        raise AppError(
            code="maps_error",
            message_he="שגיאה בטעינת פרטי הכתובת.",
            status_code=502,
        ) from exc

    loc = data.get("location") or {}
    return {
        "formatted_address": data.get("formattedAddress") or "",
        "lat": float(loc.get("latitude") or 0),
        "lng": float(loc.get("longitude") or 0),
        "location_type": "ROOFTOP",
        "confidence": 1.0,
    }


async def geocode(address: str) -> dict:
    google_exc: AppError | None = None
    if google_ready():
        try:
            return await _google_geocode(address)
        except AppError as exc:
            if exc.code != "geocode_empty":
                mark_google_failed("geocode")
            google_exc = exc
    if _free_enabled():
        try:
            return await free_geo.geocode(address)
        except free_geo.FreeGeoError as exc:
            logger.warning("Free geocode failed: %s", exc)
    if google_exc is not None:
        raise google_exc
    return maps_mock.geocode(address)


async def _google_geocode(address: str) -> dict:
    settings = get_settings()

    params = {
        "address": address,
        "language": "he",
        "region": "il",
        "key": settings.google_maps_server_key,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params=params,
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        logger.exception("Geocode failed: %s", exc)
        raise AppError(
            code="maps_error",
            message_he="שגיאה באימות הכתובת.",
            status_code=502,
        ) from exc

    status = data.get("status", "OK")
    if status not in ("OK", "ZERO_RESULTS"):
        logger.error("Geocode status %s: %s", status, data.get("error_message", "")[:300])
        raise AppError(
            code="maps_error",
            message_he="שגיאה באימות הכתובת.",
            status_code=502,
        )
    results = data.get("results") or []
    if not results:
        raise AppError(
            code="geocode_empty",
            message_he="לא נמצאה כתובת תואמת. נסו ניסוח אחר.",
            status_code=404,
        )
    first = results[0]
    loc = first["geometry"]["location"]
    location_type = first["geometry"].get("location_type", "APPROXIMATE")
    return {
        "formatted_address": first.get("formatted_address") or address,
        "lat": float(loc["lat"]),
        "lng": float(loc["lng"]),
        "location_type": location_type,
        "confidence": CONFIDENCE_BY_TYPE.get(location_type, 0.3),
    }
