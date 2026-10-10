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


def test_geocode_falls_back_to_mock_when_free_fails(monkeypatch):
    monkeypatch.setattr(maps, "google_ready", lambda: False)

    async def boom(_address):
        raise free_geo.FreeGeoError("offline")

    monkeypatch.setattr(free_geo, "geocode", boom)
    out = asyncio.run(maps.geocode("דיזנגוף 50"))
    assert "lat" in out and "lng" in out


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
    monkeypatch.setattr(matrix, "apply_learned_factors", lambda _db, m, _c: m)

    coords = [(32.0, 34.7), (32.1, 34.8), (32.2, 34.9)]
    out = asyncio.run(
        matrix.build_matrices(None, route_id=-1, coords=coords, departure_time=time(7, 0))
    )
    assert failed == ["route matrix"]
    assert out["morning"][0][1] == round(10 * matrix.OSRM_TRAFFIC["morning"])
    # A fallback result is not cached, so Google is retried once it recovers.
    assert (-1, time(7, 0).isoformat()) not in matrix._MATRIX_CACHE
