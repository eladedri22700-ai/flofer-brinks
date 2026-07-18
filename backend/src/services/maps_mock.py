"""Mock Google Places / Geocoding for demo without API keys."""

from __future__ import annotations

MOCK_PLACES: list[dict] = [
    {
        "place_id": "mock_dizengoff_50",
        "description": "דיזנגוף 50, תל אביב-יפו",
        "formatted_address": "דיזנגוף 50, תל אביב-יפו",
        "lat": 32.0782,
        "lng": 34.7745,
        "location_type": "ROOFTOP",
        "confidence": 1.0,
    },
    {
        "place_id": "mock_rothschild_22",
        "description": "רוטשילד 22, תל אביב-יפו",
        "formatted_address": "רוטשילד 22, תל אביב-יפו",
        "lat": 32.0628,
        "lng": 34.7712,
        "location_type": "ROOFTOP",
        "confidence": 1.0,
    },
    {
        "place_id": "mock_ibn_gabirol_71",
        "description": "אבן גבירול 71, תל אביב-יפו",
        "formatted_address": "אבן גבירול 71, תל אביב-יפו",
        "lat": 32.0851,
        "lng": 34.7818,
        "location_type": "ROOFTOP",
        "confidence": 1.0,
    },
    {
        "place_id": "mock_herzl_12_holon",
        "description": "הרצל 12, חולון",
        "formatted_address": "הרצל 12, חולון",
        "lat": 32.0114,
        "lng": 34.7748,
        "location_type": "RANGE_INTERPOLATED",
        "confidence": 0.7,
    },
    {
        "place_id": "mock_begin_132_rmg",
        "description": "דרך מנחם בגין 132, רמת גן",
        "formatted_address": "דרך מנחם בגין 132, רמת גן",
        "lat": 32.0833,
        "lng": 34.8044,
        "location_type": "ROOFTOP",
        "confidence": 1.0,
    },
    {
        "place_id": "mock_ind_holon",
        "description": "אזור התעשייה חולון",
        "formatted_address": "אזור התעשייה, חולון",
        "lat": 32.0050,
        "lng": 34.7850,
        "location_type": "APPROXIMATE",
        "confidence": 0.3,
    },
]


def autocomplete(query: str) -> list[dict]:
    q = (query or "").strip().casefold()
    if not q:
        return []
    hits = [p for p in MOCK_PLACES if q in p["description"].casefold()]
    if not hits:
        hits = [p for p in MOCK_PLACES if any(part in p["description"].casefold() for part in q.split())]
    return [{"place_id": p["place_id"], "description": p["description"]} for p in hits[:8]]


def place_details(place_id: str) -> dict | None:
    for p in MOCK_PLACES:
        if p["place_id"] == place_id:
            return {
                "formatted_address": p["formatted_address"],
                "lat": p["lat"],
                "lng": p["lng"],
                "location_type": p["location_type"],
                "confidence": p["confidence"],
            }
    return None


def geocode(address: str) -> dict:
    q = (address or "").strip().casefold()
    for p in MOCK_PLACES:
        if q in p["description"].casefold() or q in p["formatted_address"].casefold():
            return {
                "formatted_address": p["formatted_address"],
                "lat": p["lat"],
                "lng": p["lng"],
                "location_type": p["location_type"],
                "confidence": p["confidence"],
            }
    # Vague industrial / area keywords → low confidence
    vague = any(w in q for w in ("אזור", "תעשייה", "ליד", "סביב"))
    return {
        "formatted_address": address.strip() or "כתובת לא מזוהה",
        "lat": 32.0853,
        "lng": 34.7818,
        "location_type": "APPROXIMATE" if vague else "GEOMETRIC_CENTER",
        "confidence": 0.3 if vague else 0.5,
    }
