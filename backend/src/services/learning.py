"""Learning capture — service/leg samples, parking median, customer stats."""

from __future__ import annotations

from datetime import datetime
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from src.models.customer import Customer
from src.models.leg_sample import LegSample
from src.models.service_sample import ServiceSample
from src.models.stop import Stop

JERUSALEM = ZoneInfo("Asia/Jerusalem")


def day_bucket(dt: datetime) -> str:
    local = dt.astimezone(JERUSALEM)
    # Mon=0 .. Sun=6 — Friday is weekend-ish in Israel
    if local.weekday() == 4:
        return "friday"
    if local.weekday() == 5:
        return "other"
    return "weekday"


def hour_bucket(dt: datetime) -> int:
    return dt.astimezone(JERUSALEM).hour


def _sorted_non_outlier_durations(db: Session, customer_id: int) -> list[float]:
    rows = (
        db.query(ServiceSample)
        .filter(
            ServiceSample.customer_id == customer_id,
            ServiceSample.is_outlier.is_(False),
        )
        .order_by(ServiceSample.recorded_at.asc())
        .all()
    )
    return [r.duration_min for r in rows]


def ewma_median(values: list[float], alpha: float = 0.3) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    # Weighted toward recent: duplicate recent samples then take median
    weighted: list[float] = []
    n = len(values)
    for i, v in enumerate(values):
        w = max(1, int(round(1 + alpha * (i + 1))))
        weighted.extend([v] * w)
    weighted.sort()
    return float(median(weighted))


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    idx = min(len(s) - 1, max(0, int(round((p / 100.0) * (len(s) - 1)))))
    return float(s[idx])


def is_outlier_duration(
    duration_min: float,
    exception_code: str,
    current_median: float | None,
) -> bool:
    if exception_code and exception_code != "none":
        return True
    if current_median is not None and current_median > 0 and duration_min > 3 * current_median:
        return True
    return False


def record_parking_fix(
    db: Session, customer: Customer, lat: float, lng: float
) -> None:
    fixes = list(customer.parking_fixes or [])
    fixes.append({"lat": lat, "lng": lng})
    customer.parking_fixes = fixes
    customer.parking_sample_count = len(fixes)
    if len(fixes) >= 3:
        lats = sorted(f["lat"] for f in fixes)
        lngs = sorted(f["lng"] for f in fixes)
        mid = len(fixes) // 2
        customer.parking_lat = lats[mid]
        customer.parking_lng = lngs[mid]
    db.add(customer)


def recompute_customer_service_stats(db: Session, customer: Customer) -> None:
    values = _sorted_non_outlier_durations(db, customer.id)
    customer.service_sample_count = (
        db.query(ServiceSample).filter(ServiceSample.customer_id == customer.id).count()
    )
    if len(values) >= 3:
        customer.learned_service_min = ewma_median(values)
        customer.learned_service_p80 = percentile(values, 80)
    db.add(customer)


def capture_service_sample(
    db: Session,
    *,
    stop: Stop,
    customer: Customer,
    arrival: datetime,
    departure: datetime,
    exception_code: str,
) -> ServiceSample:
    duration = max(0.5, (departure - arrival).total_seconds() / 60.0)
    current_med = customer.learned_service_min
    if current_med is None and customer.default_service_min:
        current_med = float(customer.default_service_min)
    outlier = is_outlier_duration(duration, exception_code, current_med)
    sample = ServiceSample(
        customer_id=customer.id,
        stop_id=stop.id,
        duration_min=duration,
        day_bucket=day_bucket(arrival),
        hour_bucket=hour_bucket(arrival),
        exception_code=exception_code or "none",
        is_outlier=outlier,
        recorded_at=departure,
    )
    db.add(sample)
    db.flush()
    recompute_customer_service_stats(db, customer)
    return sample


def capture_leg_sample(
    db: Session,
    *,
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    from_customer_id: int | None,
    to_customer_id: int | None,
    departure_at: datetime,
    arrival_at: datetime,
    predicted_min: float,
) -> LegSample:
    actual = max(0.5, (arrival_at - departure_at).total_seconds() / 60.0)
    row = LegSample(
        from_lat=from_lat,
        from_lng=from_lng,
        to_lat=to_lat,
        to_lng=to_lng,
        from_customer_id=from_customer_id,
        to_customer_id=to_customer_id,
        hour_bucket=hour_bucket(departure_at),
        day_bucket=day_bucket(departure_at),
        predicted_min=max(0.5, predicted_min),
        actual_min=actual,
        recorded_at=arrival_at,
    )
    db.add(row)
    return row
