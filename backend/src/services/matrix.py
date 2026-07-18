"""Time-dependent travel matrices — Google Routes or mock."""

from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.exceptions import AppError
from src.services import matrix_mock
from src.services.matrix_learning import apply_learned_factors

logger = logging.getLogger(__name__)
JERUSALEM = ZoneInfo("Asia/Jerusalem")

# In-memory cache: (route_id, departure_iso) -> matrices
_MATRIX_CACHE: dict[tuple[int, str], dict[str, list[list[int]]]] = {}


def pick_matrix(
    matrices: dict[str, list[list[int]]], estimated_hour: int
) -> list[list[int]]:
    if estimated_hour < 10:
        return matrices["morning"]
    if estimated_hour < 14:
        return matrices["midday"]
    return matrices["afternoon"]

def _bucket_datetimes(departure: time, day: datetime) -> dict[str, datetime]:
    base = day.replace(
        hour=departure.hour,
        minute=departure.minute,
        second=0,
        microsecond=0,
        tzinfo=JERUSALEM,
    )
    return {
        "morning": base,
        "midday": base + timedelta(hours=4),
        "afternoon": base + timedelta(hours=7),
    }


async def _google_matrix(
    coords: list[tuple[float, float]], departure: datetime
) -> list[list[int]]:
    settings = get_settings()
    n = len(coords)
    mat = [[0] * n for _ in range(n)]
    # chunk origins/destinations to stay under 625 elements
    chunk = 10
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_maps_server_key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,status",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        for o0 in range(0, n, chunk):
            for d0 in range(0, n, chunk):
                origins = [
                    {"waypoint": {"location": {"latLng": {"latitude": lat, "longitude": lng}}}}
                    for lat, lng in coords[o0 : o0 + chunk]
                ]
                destinations = [
                    {"waypoint": {"location": {"latLng": {"latitude": lat, "longitude": lng}}}}
                    for lat, lng in coords[d0 : d0 + chunk]
                ]
                body: dict[str, Any] = {
                    "origins": origins,
                    "destinations": destinations,
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
                    "departureTime": departure.isoformat(),
                    "languageCode": "he",
                }
                try:
                    res = await client.post(
                        "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
                        headers=headers,
                        json=body,
                    )
                    res.raise_for_status()
                    # API may return NDJSON array
                    data = res.json()
                    if isinstance(data, dict):
                        rows = data.get("routes") or data
                        if not isinstance(rows, list):
                            rows = []
                    else:
                        rows = data
                except httpx.HTTPError as exc:
                    logger.exception("Routes matrix failed: %s", exc)
                    raise AppError(
                        code="matrix_error",
                        message_he="שגיאה בחישוב מרחקים מגוגל. בדקו מפתח או נסו שוב.",
                        status_code=502,
                    ) from exc
                for item in rows:
                    if not isinstance(item, dict):
                        continue
                    oi = item.get("originIndex")
                    di = item.get("destinationIndex")
                    if oi is None or di is None:
                        continue
                    dur = item.get("duration") or "0s"
                    secs = int(str(dur).rstrip("s") or "0")
                    mat[o0 + oi][d0 + di] = max(0, secs // 60)
    return mat


async def build_matrices(
    db: Session,
    *,
    route_id: int,
    coords: list[tuple[float, float]],
    departure_time: time,
    route_date: datetime | None = None,
    force_refresh: bool = False,
) -> dict[str, list[list[int]]]:
    cache_key = (route_id, departure_time.isoformat())
    if not force_refresh and cache_key in _MATRIX_CACHE:
        return _MATRIX_CACHE[cache_key]

    settings = get_settings()
    day = route_date or datetime.now(JERUSALEM)

    if not settings.maps_live:
        matrices = matrix_mock.build_mock_matrices(coords, departure_time)
    else:
        buckets = _bucket_datetimes(departure_time, day)
        matrices = {}
        for name, dep in buckets.items():
            matrices[name] = await _google_matrix(coords, dep)

    matrices = apply_learned_factors(db, matrices, coords)
    _MATRIX_CACHE[cache_key] = matrices
    return matrices


def clear_matrix_cache(route_id: int | None = None) -> None:
    if route_id is None:
        _MATRIX_CACHE.clear()
        return
    for key in list(_MATRIX_CACHE.keys()):
        if key[0] == route_id:
            del _MATRIX_CACHE[key]
