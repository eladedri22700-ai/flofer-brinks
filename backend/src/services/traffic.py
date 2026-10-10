"""Real-time traffic for the live forecast (TomTom Routing, optional).

One request routes origin → every open stop → depot in the current order with
live traffic, accidents and road closures, and returns per-leg minutes plus the
delay traffic adds. Free tier: 2,500 requests/day — a crew re-forecasting
every 1–2 minutes uses a few hundred. Set TOMTOM_API_KEY to enable.

Waze has no public routing API, so it can't be queried; Waze remains the
in-car navigator (deep link from the drive screen).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)
MAX_POINTS = 150


@dataclass
class LiveLeg:
    minutes: int
    traffic_delay_min: int


def enabled() -> bool:
    return bool(get_settings().tomtom_api_key.strip())


def parse_legs(data: dict) -> list[LiveLeg]:
    routes = data.get("routes") or []
    if not routes:
        return []
    out = []
    for leg in routes[0].get("legs") or []:
        summ = leg.get("summary") or {}
        secs = float(summ.get("travelTimeInSeconds") or 0)
        delay = float(summ.get("trafficDelayInSeconds") or 0)
        out.append(LiveLeg(minutes=max(0, round(secs / 60)), traffic_delay_min=max(0, round(delay / 60))))
    return out


async def live_legs(coords: list[tuple[float, float]]) -> list[LiveLeg] | None:
    """Leg times along coords in order, with current traffic. None if unavailable."""
    if not enabled() or len(coords) < 2 or len(coords) > MAX_POINTS:
        return None
    path = ":".join(f"{lat:.6f},{lng:.6f}" for lat, lng in coords)
    params = {
        "key": get_settings().tomtom_api_key.strip(),
        "traffic": "true",
        "departAt": "now",
        "routeType": "fastest",
        "travelMode": "car",
        "computeTravelTimeFor": "all",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(
                f"https://api.tomtom.com/routing/1/calculateRoute/{path}/json", params=params
            )
            if res.is_error:
                logger.warning("TomTom routing HTTP %s", res.status_code)
                return None
            legs = parse_legs(res.json())
    except (httpx.HTTPError, ValueError):
        logger.warning("TomTom routing failed", exc_info=True)
        return None
    return legs if len(legs) == len(coords) - 1 else None
