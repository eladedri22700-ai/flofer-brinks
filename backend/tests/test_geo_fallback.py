"""Maps / matrix fallback chain — never blocks the crew when Google fails."""

import asyncio
from datetime import time
from types import SimpleNamespace

from src.core.exceptions import AppError
from src.services import free_geo, maps, matrix


def test_osm_place_id_roundtrip():
    pid = free_geo.encode_place_id(32.0782, 34.7745, "דיזנגוף 50, תל אביב")
    got = maps.free_geo.decode_place_id(pid)
    assert got is not None
    assert got["formatted_address"] == "דיזנגוף 50, תל אביב"
    assert abs(got["lat"] - 32.0782) < 1e-6
    assert asyncio.run(maps.place_details(pid))["lng"] == got["lng"]


def test_unmatched_address_is_an_error_not_a_fake_point(monkeypatch):
    """Regression: every unmatched address used to land on one Tel Aviv point."""
    import pytest

    monkeypatch.setattr(maps, "google_ready", lambda: False)
    monkeypatch.setattr(maps, "_free_enabled", lambda: True)

    async def boom(_address, **_kw):
        raise free_geo.FreeGeoError("no match")

    monkeypatch.setattr(free_geo, "geocode", boom)
    with pytest.raises(AppError) as exc:
        asyncio.run(maps.geocode("כתובת שלא קיימת 999"))
    assert exc.value.code == "geocode_empty"


def test_normalize_hebrew_abbreviations():
    assert free_geo.normalize_address("שד' רוטשילד 22 ת\"א") == "שדרות רוטשילד 22 תל אביב"
    assert free_geo.normalize_address("רח' הרצל 12 קומה 3, ראשל\"צ") == "הרצל 12, ראשון לציון"
    assert free_geo.normalize_address("ויצמן 80, כפר סבא (כניסה מהחניון)") == "ויצמן 80, כפר סבא"


def test_matrix_uses_osrm_when_google_fails(monkeypatch):
    monkeypatch.setattr(maps, "google_ready", lambda: True)
    monkeypatch.setattr(matrix, "get_settings", lambda: SimpleNamespace(maps_live=True, free_geo=True))
    failed: list[str] = []
    monkeypatch.setattr(maps, "mark_google_failed", lambda reason: failed.append(reason))

    async def google_down(*_args, **_kwargs):
        raise AppError(code="matrix_error", message_he="x", status_code=502)

    async def osrm(coords):
        return [[0 if i == j else 10 for j in range(len(coords))] for i in range(len(coords))]

    monkeypatch.setattr(matrix, "_google_matrices", google_down)
    monkeypatch.setattr(free_geo, "osrm_table", osrm)
    monkeypatch.setattr(matrix, "apply_learned_factors", lambda _db, m, _c, **_kw: m)

    coords = [(32.0, 34.7), (32.1, 34.8), (32.2, 34.9)]
    out = asyncio.run(
        matrix.build_matrices(None, route_id=-1, coords=coords, departure_time=time(7, 0))
    )
    assert failed == ["route matrix"]
    assert out["morning"][0][1] == round(10 * matrix.OSRM_TRAFFIC["morning"])
    # A fallback result is not cached, so Google is retried once it recovers.
    assert (-1, time(7, 0).isoformat()) not in matrix._MATRIX_CACHE


def test_shared_point_blocks_optimization():
    from types import SimpleNamespace as S

    from src.services.optimize_service import _shared_point_conflict

    same = dict(lat=32.0853, lng=34.7818)
    stops = [
        S(address="הרצל 1 חולון", customer_name="א", **same),
        S(address="ויצמן 3 כפר סבא", customer_name="ב", **same),
        S(address="סוקולוב 40 חולון", customer_name="ג", lat=32.016, lng=34.779),
    ]
    out = _shared_point_conflict(stops)
    assert out is not None and out["feasible"] is False
    # Two stops at the same building are fine
    assert _shared_point_conflict([S(address="הרצל 1", customer_name="א", **same), S(address="הרצל 1", customer_name="ב", **same)]) is None
