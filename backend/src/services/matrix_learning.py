"""Learn drive-time corrections from real legs and apply them to provider matrices.

Each completed leg stores the raw routing-provider minutes the plan used and the
minutes it actually took. The ratio actual/raw is learned, most specific first:

1. same road segment (≈100 m cells) at the same time of day
2. same road segment, any time
3. city-wide traffic profile for this time of day and day type (weekday/Friday…)
4. overall crew ratio

Recent legs weigh more (half-life ~3 weeks), outliers (crew stopped on the way)
are dropped, and factors are clamped so one bad day can't wreck a plan.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from src.models.leg_sample import LegSample

_PREC = 3  # ~100 m cells
MIN_PAIR_SAMPLES = 2
MIN_PROFILE_SAMPLES = 4
FACTOR_MIN, FACTOR_MAX = 0.6, 2.0
RATIO_MIN, RATIO_MAX = 0.3, 3.5  # outside → detour/stop on the way, not traffic
HALF_LIFE_DAYS = 21.0
LOOKBACK_DAYS = 120


def _cell(lat: float, lng: float) -> tuple[float, float]:
    return (round(lat, _PREC), round(lng, _PREC))


def hour_to_bucket(hour: int) -> str:
    """Same thresholds the planner uses to pick a time-of-day matrix."""
    if hour < 10:
        return "morning"
    if hour < 14:
        return "midday"
    return "afternoon"


def _day_type(day_bucket: str) -> str:
    # day_bucket values come from learning.day_bucket (weekday names / weekend)
    return day_bucket or "any"


@dataclass
class _Acc:
    """Recency-weighted geometric mean of ratios."""

    w: float = 0.0
    log_sum: float = 0.0
    n: int = 0

    def add(self, ratio: float, weight: float) -> None:
        self.w += weight
        self.log_sum += weight * math.log(ratio)
        self.n += 1

    def value(self) -> float:
        return math.exp(self.log_sum / self.w) if self.w > 0 else 1.0


@dataclass
class LearnedModel:
    pair_bucket: dict[tuple, _Acc] = field(default_factory=lambda: defaultdict(_Acc))
    pair_any: dict[tuple, _Acc] = field(default_factory=lambda: defaultdict(_Acc))
    profile: dict[tuple, _Acc] = field(default_factory=lambda: defaultdict(_Acc))
    profile_bucket: dict[str, _Acc] = field(default_factory=lambda: defaultdict(_Acc))
    overall: _Acc = field(default_factory=_Acc)

    @property
    def samples(self) -> int:
        return self.overall.n


def _clamp(f: float) -> float:
    return max(FACTOR_MIN, min(FACTOR_MAX, f))


def load_model(db: Session, *, now: datetime | None = None) -> LearnedModel:
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)
    rows = (
        db.query(LegSample)
        .filter(LegSample.predicted_source == "provider", LegSample.recorded_at >= since)
        .order_by(LegSample.recorded_at.desc())
        .limit(5000)
        .all()
    )
    model = LearnedModel()
    for r in rows:
        if not r.predicted_min or r.predicted_min <= 0.5:
            continue
        ratio = r.actual_min / r.predicted_min
        if not (RATIO_MIN <= ratio <= RATIO_MAX):
            continue
        rec = r.recorded_at if r.recorded_at.tzinfo else r.recorded_at.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (now - rec).total_seconds() / 86400)
        weight = 0.5 ** (age_days / HALF_LIFE_DAYS)
        a, b = _cell(r.from_lat, r.from_lng), _cell(r.to_lat, r.to_lng)
        bucket = hour_to_bucket(int(r.hour_bucket))
        model.pair_bucket[(a, b, bucket)].add(ratio, weight)
        model.pair_any[(a, b)].add(ratio, weight)
        model.profile[(bucket, _day_type(r.day_bucket))].add(ratio, weight)
        model.profile_bucket[bucket].add(ratio, weight)
        model.overall.add(ratio, weight)
    return model


def factor_for(
    model: LearnedModel,
    a_latlng: tuple[float, float],
    b_latlng: tuple[float, float],
    bucket: str,
    day_type: str | None = None,
) -> float:
    a, b = _cell(*a_latlng), _cell(*b_latlng)
    if a == b:
        return 1.0
    acc = model.pair_bucket.get((a, b, bucket))
    if acc and acc.n >= MIN_PAIR_SAMPLES:
        return _clamp(acc.value())
    acc = model.pair_any.get((a, b))
    if acc and acc.n >= MIN_PAIR_SAMPLES:
        return _clamp(acc.value())
    if day_type:
        acc = model.profile.get((bucket, day_type))
        if acc and acc.n >= MIN_PROFILE_SAMPLES:
            return _clamp(acc.value())
    acc = model.profile_bucket.get(bucket)
    if acc and acc.n >= MIN_PROFILE_SAMPLES:
        return _clamp(acc.value())
    if model.overall.n >= MIN_PROFILE_SAMPLES:
        return _clamp(model.overall.value())
    return 1.0


def apply_learned_factors(
    db: Session,
    matrices: dict[str, list[list[int]]],
    coords: list[tuple[float, float]],
    *,
    day_type: str | None = None,
) -> dict[str, list[list[int]]]:
    """Return learned matrices. Raw provider values are kept under "raw:<bucket>"."""
    model = load_model(db)
    out: dict[str, list[list[int]]] = {}
    for bucket_name, mat in matrices.items():
        if bucket_name.startswith("raw:"):
            continue
        out[f"raw:{bucket_name}"] = mat
        if model.samples == 0:
            out[bucket_name] = mat
            continue
        n = len(mat)
        out[bucket_name] = [
            [
                0
                if i == j
                else max(1, int(round(mat[i][j] * factor_for(model, coords[i], coords[j], bucket_name, day_type))))
                for j in range(n)
            ]
            for i in range(n)
        ]
    return out


def raw_matrix(matrices: dict[str, list[list[int]]], bucket: str) -> list[list[int]]:
    return matrices.get(f"raw:{bucket}") or matrices[bucket]


def learning_summary(db: Session) -> dict:
    """Human-readable snapshot of what the system has learned about traffic."""
    model = load_model(db)
    def pct(acc: _Acc | None) -> int | None:
        if not acc or acc.n < MIN_PROFILE_SAMPLES:
            return None
        return int(round((_clamp(acc.value()) - 1.0) * 100))
    return {
        "leg_samples": model.samples,
        "segments_learned": sum(1 for v in model.pair_any.values() if v.n >= MIN_PAIR_SAMPLES),
        "traffic_pct_by_time": {
            b: pct(model.profile_bucket.get(b)) for b in ("morning", "midday", "afternoon")
        },
        "overall_pct": pct(model.overall),
    }
