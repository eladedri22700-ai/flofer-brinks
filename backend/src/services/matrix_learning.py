"""Apply learned leg correction factors by hour/day bucket. Safe no-op if sparse."""

from __future__ import annotations

from collections import defaultdict
from statistics import median

from sqlalchemy.orm import Session

from src.models.leg_sample import LegSample

# Round coords to ~100m cells for matching
_PREC = 3


def _cell(lat: float, lng: float) -> tuple[float, float]:
    return (round(lat, _PREC), round(lng, _PREC))


def apply_learned_factors(
    db: Session,
    matrices: dict[str, list[list[int]]],
    coords: list[tuple[float, float]],
) -> dict[str, list[list[int]]]:
    """
    Multiply matrix cells by learned actual/predicted ratio when >=3 samples
    match the (from_cell, to_cell, hour_bucket) or day_bucket aggregate.
    Clamp factor to [0.8, 1.3]. No-op when insufficient data.
    """
    rows = db.query(LegSample).order_by(LegSample.recorded_at.desc()).limit(2000).all()
    if len(rows) < 3:
        return matrices

    # key: (from_cell, to_cell, hour) -> list of ratios
    by_hour: dict[tuple, list[float]] = defaultdict(list)
    by_day: dict[tuple, list[float]] = defaultdict(list)
    global_ratios: list[float] = []

    for r in rows:
        if not r.predicted_min or r.predicted_min <= 0:
            continue
        ratio = r.actual_min / r.predicted_min
        global_ratios.append(ratio)
        fk = (_cell(r.from_lat, r.from_lng), _cell(r.to_lat, r.to_lng), r.hour_bucket)
        by_hour[fk].append(ratio)
        dk = (_cell(r.from_lat, r.from_lng), _cell(r.to_lat, r.to_lng), r.day_bucket)
        by_day[dk].append(ratio)

    hour_name_to_bucket = {"morning": 8, "midday": 12, "afternoon": 16}

    def factor_for(i: int, j: int, bucket_name: str) -> float:
        if i == j:
            return 1.0
        a, b = _cell(coords[i][0], coords[i][1]), _cell(coords[j][0], coords[j][1])
        hb = hour_name_to_bucket.get(bucket_name, 12)
        key_h = (a, b, hb)
        if len(by_hour.get(key_h, [])) >= 3:
            f = median(by_hour[key_h])
            return max(0.8, min(1.3, float(f)))
        # fall back: any day_bucket for same pair with enough samples
        for (fa, fb, _db), vals in by_day.items():
            if fa == a and fb == b and len(vals) >= 3:
                return max(0.8, min(1.3, float(median(vals))))
        if len(global_ratios) >= 3:
            g = float(median(global_ratios))
            if abs(g - 1.0) >= 0.02:
                return max(0.8, min(1.3, g))
        return 1.0

    out: dict[str, list[list[int]]] = {}
    for bucket_name, mat in matrices.items():
        n = len(mat)
        out[bucket_name] = [
            [
                max(1, int(round(mat[i][j] * factor_for(i, j, bucket_name))))
                if i != j
                else 0
                for j in range(n)
            ]
            for i in range(n)
        ]
    return out
