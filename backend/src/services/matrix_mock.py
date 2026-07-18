"""Mock travel-time matrices (Haversine × time-of-day speeds). Not a routing solver."""

from __future__ import annotations

import hashlib
import math
from datetime import time


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _jitter_factor(i: int, j: int, bucket: str) -> float:
    raw = hashlib.sha256(f"{bucket}:{i}:{j}".encode()).hexdigest()
    # 0.92 .. 1.08 deterministic
    n = int(raw[:8], 16) / 0xFFFFFFFF
    return 0.92 + n * 0.16


SPEED_KMH = {
    "morning": 22.0,
    "midday": 28.0,
    "afternoon": 24.0,
}


def build_mock_matrices(
    coords: list[tuple[float, float]],
    departure_time: time,
) -> dict[str, list[list[int]]]:
    """Return duration matrices in whole minutes for each time bucket."""
    n = len(coords)
    out: dict[str, list[list[int]]] = {}
    for bucket, speed in SPEED_KMH.items():
        mat = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                km = haversine_km(
                    coords[i][0], coords[i][1], coords[j][0], coords[j][1]
                )
                # urban factor ~1.35 road distance
                minutes = (km * 1.35 / speed) * 60.0 * _jitter_factor(i, j, bucket)
                mat[i][j] = max(1, int(round(minutes)))
        out[bucket] = mat
    # departure_time unused for structure but kept for API parity
    _ = departure_time
    return out
