"""Free OpenStreetMap providers — used when Google is unset, unbilled or down.

- Photon (komoot) for search-as-you-type suggestions (Nominatim forbids autocomplete).
- Nominatim for one-shot geocoding.
- OSRM public router for a real road-network travel-time table.

All calls are best-effort: callers catch ``FreeGeoError`` and fall back further.
"""

from __future__ import annotations

import asyncio
import re
import logging
import time as _time
from urllib.parse import quote, unquote

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "FLOFER-BRINKS/1.0 (route planning; contact via app owner)"
# Bias suggestions to Israel
IL_VIEWBOX = "34.2,33.4,35.9,29.4"  # lon_min,lat_max,lon_max,lat_min
IL_CENTER = (31.9, 34.85)

PLACE_PREFIX = "osm:"

# Nominatim policy: max 1 request / second per application.
_nominatim_lock = asyncio.Lock()
_nominatim_last = 0.0


class FreeGeoError(Exception):
    pass


def encode_place_id(lat: float, lng: float, label: str) -> str:
    return f"{PLACE_PREFIX}{lat:.6f}:{lng:.6f}:{quote(label, safe='')}"


def decode_place_id(place_id: str) -> dict | None:
    if not place_id.startswith(PLACE_PREFIX):
        return None
    try:
        lat_s, lng_s, label = place_id[len(PLACE_PREFIX) :].split(":", 2)
        return {
            "formatted_address": unquote(label),
            "lat": float(lat_s),
            "lng": float(lng_s),
            "location_type": "RANGE_INTERPOLATED",
            "confidence": 0.7,
        }
    except ValueError:
        return None


def _photon_label(props: dict) -> str:
    street = props.get("street") or ""
    number = props.get("housenumber") or ""
    name = props.get("name") or ""
    city = props.get("city") or props.get("town") or props.get("village") or ""
    head = f"{street} {number}".strip() if street else name
    if name and street and name not in (street, head):
        head = f"{name}, {head}"
    parts = [p for p in (head, city) if p]
    return ", ".join(parts) or name


async def autocomplete(
    query: str, *, lat: float | None = None, lng: float | None = None, limit: int = 6
) -> list[dict]:
    bias_lat, bias_lng = (lat, lng) if lat is not None and lng is not None else IL_CENTER
    params = {
        "q": query,
        "limit": str(limit),
        "lat": f"{bias_lat}",
        "lon": f"{bias_lng}",
        "bbox": "34.2,29.4,35.9,33.4",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": USER_AGENT}) as client:
            res = await client.get("https://photon.komoot.io/api/", params=params)
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise FreeGeoError(f"photon: {exc}") from exc

    out: list[dict] = []
    seen: set[str] = set()
    for feat in data.get("features") or []:
        coords = (feat.get("geometry") or {}).get("coordinates") or []
        if len(coords) != 2:
            continue
        label = _photon_label(feat.get("properties") or {})
        if not label or label in seen:
            continue
        seen.add(label)
        out.append(
            {
                "place_id": encode_place_id(float(coords[1]), float(coords[0]), label),
                "description": label,
            }
        )
    return out


async def nominatim_geocode(address: str) -> dict:
    global _nominatim_last
    params = {
        "q": address,
        "format": "jsonv2",
        "limit": "1",
        "countrycodes": "il",
        "accept-language": "he",
        "addressdetails": "1",
    }
    async with _nominatim_lock:
        wait = 1.05 - (_time.monotonic() - _nominatim_last)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
                res = await client.get("https://nominatim.openstreetmap.org/search", params=params)
                res.raise_for_status()
                rows = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise FreeGeoError(f"nominatim: {exc}") from exc
        finally:
            _nominatim_last = _time.monotonic()

    if not rows:
        raise FreeGeoError("nominatim: no results")
    first = rows[0]
    rank = int(first.get("place_rank") or 0)
    # place_rank 30 = building/house number; lower ranks are streets or areas
    if rank >= 28:
        location_type, confidence = "ROOFTOP", 0.9
    elif rank >= 26:
        location_type, confidence = "RANGE_INTERPOLATED", 0.6
    else:
        location_type, confidence = "APPROXIMATE", 0.3
    return {
        "formatted_address": _nominatim_label(first) or address,
        "lat": float(first["lat"]),
        "lng": float(first["lon"]),
        "location_type": location_type,
        "confidence": confidence,
    }


# ---------------------------------------------------------------------------
# Robust Hebrew geocoding: normalise → Photon → Nominatim → business name.
# ---------------------------------------------------------------------------

_ABBREV = [
    (r'ת["״]א', "תל אביב"),
    (r'ר["״]ג', "רמת גן"),
    (r'פ["״]ת', "פתח תקווה"),
    (r'ב["״]ב', "בני ברק"),
    (r'ראשל["״]צ', "ראשון לציון"),
    (r'ק["״]ש', "קריית שמונה"),
    (r'(^|\s)י-?ם($|\s|,)', r"\1ירושלים\2"),
    (r"(^|\s)שד['׳]\s*", r"\1שדרות "),
    (r"(^|\s)רח['׳]\s*", r"\1"),
    (r"(^|\s)רחוב\s+", r"\1"),
    (r"(^|\s)דר['׳]\s*", r"\1דרך "),
]
_NOISE = re.compile(
    r"\(.*?\)|(קומה|דירה|כניסה|בניין|ת\.?ד\.?|מיקוד)\s*[\w\d-]*|טל['׳]?[:\s]*[\d-]{7,}",
)


def normalize_address(address: str) -> str:
    """Clean OCR / typed Hebrew addresses so OSM search engines match them."""
    s = (address or "").replace("\n", " ").strip()
    s = _NOISE.sub(" ", s)
    for pat, rep in _ABBREV:
        s = re.sub(pat, rep, s)
    s = re.sub(r"\s*,\s*", ", ", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" ,-")
    return s


def _photon_confidence(kind: str | None) -> tuple[str, float]:
    if kind == "house":
        return "ROOFTOP", 0.9
    if kind in ("street", "other"):
        return "RANGE_INTERPOLATED", 0.6
    return "APPROXIMATE", 0.3


async def photon_geocode(query: str, *, poi: bool = False) -> dict:
    params = {"q": query, "limit": "1", "lat": "31.9", "lon": "34.85", "bbox": "34.2,29.4,35.9,33.4"}
    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            res = await client.get("https://photon.komoot.io/api/", params=params)
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise FreeGeoError(f"photon: {exc}") from exc
    feats = data.get("features") or []
    if not feats:
        raise FreeGeoError("photon: no results")
    feat = feats[0]
    lng, lat = feat["geometry"]["coordinates"]
    props = feat.get("properties") or {}
    location_type, confidence = _photon_confidence(props.get("type"))
    if poi and props.get("type") not in ("city", "district", "locality", "county", "state"):
        location_type, confidence = "ROOFTOP", 0.75
    return {
        "formatted_address": _photon_label(props) or query,
        "lat": float(lat),
        "lng": float(lng),
        "location_type": location_type,
        "confidence": confidence,
        "_city": props.get("city") or props.get("town") or props.get("village") or "",
    }


def _same_city(result: dict, query: str) -> bool:
    """Reject matches in a different city than the one written (OSM fuzzy-matches names)."""
    city = (result.get("_city") or "").replace("־", " ").replace("–", " ").replace("-", " ")
    q = query.replace("־", " ").replace("–", " ").replace("-", " ")
    if not city:
        return True
    first_word = city.split()[0]
    known = ("תל", "רמת", "פתח", "בני", "ראשון", "חולון", "בת", "הרצליה", "רעננה", "כפר", "גבעתיים",
             "ירושלים", "חיפה", "באר", "אשדוד", "נתניה", "רחובות", "יהוד", "אור", "קריית", "לוד", "רמלה")
    mentions_some_city = any(k in q for k in known)
    return (first_word in q) or not mentions_some_city


async def geocode(address: str, *, name: str | None = None) -> dict:
    """Best free match for an Israeli address. Raises FreeGeoError if nothing credible."""
    q = normalize_address(address)
    candidates: list[dict] = []
    for attempt in (lambda: photon_geocode(q), lambda: nominatim_geocode(q)):
        try:
            res = await attempt()
        except FreeGeoError:
            continue
        if not _same_city(res, q):
            res["confidence"] = min(res["confidence"], 0.25)
        candidates.append(res)
        if res["confidence"] >= 0.6:
            break
    best = max(candidates, key=lambda r: r["confidence"], default=None)
    if (best is None or best["confidence"] < 0.6) and name:
        # Business name + the address words (e.g. «סופר פארם אבן גבירול»)
        try:
            res = await photon_geocode(f"{name} {q}".strip(), poi=True)
            if _same_city(res, q) and (best is None or res["confidence"] > best["confidence"]):
                best = res
        except FreeGeoError:
            pass
    if best is None:
        raise FreeGeoError(f"no match for {address!r}")
    best.pop("_city", None)
    return best


def _nominatim_label(row: dict) -> str:
    addr = row.get("address") or {}
    road = addr.get("road") or addr.get("pedestrian") or ""
    number = addr.get("house_number") or ""
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb") or ""
    head = f"{road} {number}".strip() or row.get("name") or ""
    parts = [p for p in (head, city) if p]
    return ", ".join(parts)


async def osrm_table(coords: list[tuple[float, float]]) -> list[list[int]]:
    """Free-flow driving minutes between all coords via the public OSRM router."""
    if len(coords) < 2:
        return [[0] * len(coords) for _ in coords]
    path = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in coords)
    url = f"https://router.project-osrm.org/table/v1/driving/{path}"
    try:
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
            res = await client.get(url, params={"annotations": "duration"})
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise FreeGeoError(f"osrm: {exc}") from exc
    if data.get("code") != "Ok":
        raise FreeGeoError(f"osrm: {data.get('code')}")
    durations = data.get("durations") or []
    n = len(coords)
    if len(durations) != n:
        raise FreeGeoError("osrm: bad table size")
    out: list[list[int]] = []
    for row in durations:
        out.append([max(0, round((sec or 0) / 60)) for sec in row])
    for i in range(n):
        out[i][i] = 0
    return out
