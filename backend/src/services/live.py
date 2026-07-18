"""Live Mode stop lifecycle, work_days, and route events."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from src.core.exceptions import AppError
from src.models.depot import Depot
from src.models.route import Route
from src.models.route_event import RouteEvent
from src.models.stop import Stop
from src.models.user_settings import UserSettings
from src.models.work_day import WorkDay
from src.services import learning
from src.services.matrix_mock import haversine_km
from src.services.optimize_service import apply_order_etas

JERUSALEM = ZoneInfo("Asia/Jerusalem")

EXCEPTION_CODES = {
    "none",
    "customer_not_ready",
    "gate_wait",
    "parking",
    "closed",
    "branch_busy",
    "other",
}


def _now() -> datetime:
    return datetime.now(JERUSALEM)


def get_depot(db: Session) -> Depot:
    depot = db.query(Depot).order_by(Depot.id.asc()).first()
    if depot is None:
        raise AppError(
            code="depot_missing",
            message_he="לא הוגדר סניף.",
            status_code=500,
        )
    return depot


def get_or_create_work_day(db: Session, user_id: int, route: Route) -> WorkDay:
    wd = (
        db.query(WorkDay)
        .filter(WorkDay.user_id == user_id, WorkDay.date == route.date)
        .first()
    )
    if wd is None:
        wd = WorkDay(user_id=user_id, date=route.date, route_id=route.id)
        db.add(wd)
        db.flush()
    elif wd.route_id is None:
        wd.route_id = route.id
    return wd


async def start_route(db: Session, route: Route, user_id: int) -> Route:
    """Start the round now: lock departure clock, refresh ETAs, open work day."""
    if not route.stops:
        raise AppError(
            code="no_stops",
            message_he="אין יעדים בסבב.",
            status_code=400,
        )
    if route.status == "in_progress":
        return route

    now = _now()
    route.departure_time = time(now.hour, now.minute)
    stop_ids = [
        s.id
        for s in sorted(route.stops, key=lambda x: x.sequence_order)
        if s.status not in ("done", "skipped")
    ]
    # Include completed stops to keep full order for ETA bookkeeping
    if len(stop_ids) != len(route.stops):
        stop_ids = [s.id for s in sorted(route.stops, key=lambda x: x.sequence_order)]

    await apply_order_etas(db, route, stop_ids, set_status=None)

    route.status = "in_progress"
    wd = get_or_create_work_day(db, user_id, route)
    if wd.start_at is None:
        wd.start_at = now
    db.add(
        RouteEvent(
            route_id=route.id,
            type="route_started",
            payload={"at": now.isoformat(), "departure": route.departure_time.isoformat()},
        )
    )
    db.commit()
    db.refresh(route)
    return route


def mark_arrive(
    db: Session,
    stop: Stop,
    *,
    lat: float | None = None,
    lng: float | None = None,
) -> Stop:
    if stop.status in ("done", "skipped"):
        raise AppError(
            code="stop_closed",
            message_he="היעד כבר הושלם או דולג.",
            status_code=400,
        )
    stop.status = "arrived"
    stop.actual_arrival = stop.actual_arrival or _now()
    if lat is not None and lng is not None:
        stop.actual_park_lat = lat
        stop.actual_park_lng = lng
    db.commit()
    db.refresh(stop)
    return stop


def complete_stop(
    db: Session,
    route: Route,
    stop: Stop,
    *,
    exception_code: str = "none",
    exception_note: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    departure_at: datetime | None = None,
) -> dict[str, Any]:
    code = exception_code if exception_code in EXCEPTION_CODES else "other"
    now = departure_at or _now()
    if stop.status in ("done", "skipped"):
        raise AppError(
            code="stop_closed",
            message_he="היעד כבר הושלם או דולג.",
            status_code=400,
        )

    if stop.actual_arrival is None:
        stop.actual_arrival = now
    if lat is not None and lng is not None:
        stop.actual_park_lat = lat
        stop.actual_park_lng = lng
    stop.actual_departure = now
    stop.status = "done"
    stop.exception_code = code
    stop.exception_note = exception_note

    customer = stop.customer
    if customer is not None:
        learning.capture_service_sample(
            db,
            stop=stop,
            customer=customer,
            arrival=stop.actual_arrival,
            departure=now,
            exception_code=code,
        )
        if stop.actual_park_lat is not None and stop.actual_park_lng is not None:
            learning.record_parking_fix(
                db, customer, stop.actual_park_lat, stop.actual_park_lng
            )

    # Leg sample from previous completed/skipped stop (or depot start)
    _maybe_leg_sample(db, route, stop)

    db.add(
        RouteEvent(
            route_id=route.id,
            type="stop_completed",
            payload={"stop_id": stop.id, "exception_code": code},
        )
    )
    db.commit()
    db.refresh(stop)
    return {"ok": True, "stop_id": stop.id, "status": stop.status}


def skip_stop(
    db: Session,
    route: Route,
    stop: Stop,
    *,
    note: str | None = None,
) -> dict[str, Any]:
    if stop.status == "done":
        raise AppError(
            code="stop_done",
            message_he="לא ניתן לדלג על יעד שבוצע.",
            status_code=400,
        )
    stop.status = "skipped"
    stop.exception_code = "other"
    stop.exception_note = note or "דולג"
    stop.actual_departure = _now()
    if stop.actual_arrival is None:
        stop.actual_arrival = stop.actual_departure
    db.add(
        RouteEvent(
            route_id=route.id,
            type="stop_skipped",
            payload={"stop_id": stop.id, "note": note},
        )
    )
    db.commit()
    return {"ok": True, "stop_id": stop.id, "status": "skipped"}


def _estimate_predicted_min(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    km = haversine_km(from_lat, from_lng, to_lat, to_lng) * 1.35
    return max(1.0, (km / 25.0) * 60.0)


def _maybe_leg_sample(db: Session, route: Route, arrived_stop: Stop) -> None:
    if arrived_stop.actual_arrival is None:
        return
    ordered = sorted(route.stops or [], key=lambda s: s.sequence_order)
    idx = next((i for i, s in enumerate(ordered) if s.id == arrived_stop.id), None)
    if idx is None:
        return

    depot = get_depot(db)
    if idx == 0:
        from_lat, from_lng = depot.lat, depot.lng
        from_cid = None
        # departure from depot ≈ route start / work day start
        wd = (
            db.query(WorkDay)
            .filter(WorkDay.route_id == route.id)
            .first()
        )
        dep_at = (wd.start_at if wd and wd.start_at else None) or arrived_stop.actual_arrival
    else:
        prev = None
        for j in range(idx - 1, -1, -1):
            if ordered[j].status in ("done", "skipped") and ordered[j].actual_departure:
                prev = ordered[j]
                break
        if prev is None:
            return
        from_lat = prev.actual_park_lat or prev.lat
        from_lng = prev.actual_park_lng or prev.lng
        from_cid = prev.customer_id
        dep_at = prev.actual_departure
        if dep_at is None:
            return

    to_lat = arrived_stop.actual_park_lat or arrived_stop.lat
    to_lng = arrived_stop.actual_park_lng or arrived_stop.lng
    predicted = _estimate_predicted_min(from_lat, from_lng, to_lat, to_lng)
    learning.capture_leg_sample(
        db,
        from_lat=from_lat,
        from_lng=from_lng,
        to_lat=to_lat,
        to_lng=to_lng,
        from_customer_id=from_cid,
        to_customer_id=arrived_stop.customer_id,
        departure_at=dep_at,
        arrival_at=arrived_stop.actual_arrival,
        predicted_min=predicted,
    )


def depot_geofence_event(
    db: Session,
    route: Route,
    user_id: int,
    *,
    event: str,  # exit | enter
    lat: float | None = None,
    lng: float | None = None,
) -> WorkDay:
    wd = get_or_create_work_day(db, user_id, route)
    now = _now()
    if event == "exit" and wd.start_at is None:
        wd.start_at = now
        db.add(
            RouteEvent(
                route_id=route.id,
                type="depot_exit",
                payload={"lat": lat, "lng": lng, "at": now.isoformat()},
            )
        )
    elif event == "enter":
        wd.end_at = now
        if wd.start_at:
            total = int((now - wd.start_at).total_seconds() / 60)
            wd.total_min = max(0, total - (wd.break_min or 0))
            settings = (
                db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
            )
            std = settings.standard_day_min if settings else 516
            wd.overtime_min = max(0, (wd.total_min or 0) - std)
        if route.status == "in_progress":
            route.status = "completed"
        db.add(
            RouteEvent(
                route_id=route.id,
                type="depot_enter",
                payload={"lat": lat, "lng": lng, "at": now.isoformat()},
            )
        )
    db.commit()
    db.refresh(wd)
    return wd


def patch_work_day(
    db: Session,
    route: Route,
    user_id: int,
    *,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    note: str | None = None,
) -> WorkDay:
    wd = get_or_create_work_day(db, user_id, route)
    if start_at is not None:
        wd.start_at = start_at
    if end_at is not None:
        wd.end_at = end_at
    wd.manually_edited = True
    wd.edit_note = note or wd.edit_note
    if wd.start_at and wd.end_at:
        wd.total_min = max(
            0, int((wd.end_at - wd.start_at).total_seconds() / 60) - (wd.break_min or 0)
        )
    db.add(
        RouteEvent(
            route_id=route.id,
            type="work_day_edited",
            payload={"note": note, "start_at": str(start_at), "end_at": str(end_at)},
        )
    )
    db.commit()
    db.refresh(wd)
    return wd


def log_event(
    db: Session, route_id: int, event_type: str, payload: dict | None = None
) -> RouteEvent:
    ev = RouteEvent(route_id=route_id, type=event_type, payload=payload)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def cumulative_delay_min(route: Route) -> int:
    """Sum of (actual_arrival - eta) for arrived/done stops with both times."""
    delay = 0
    for s in route.stops or []:
        if s.eta and s.actual_arrival and s.status in ("arrived", "done"):
            d = int((s.actual_arrival - s.eta).total_seconds() / 60)
            if d > 0:
                delay += d
    return delay


def adjusted_return_iso(route: Route) -> str | None:
    """Planned return_at from solver, shifted by cumulative positive delay."""
    from datetime import timedelta

    expl = route.solver_explanation if isinstance(route.solver_explanation, dict) else {}
    raw = expl.get("return_at")
    if not raw:
        # Fallback: last pending/done stop ETA + 20 min buffer to depot
        stops = sorted(route.stops or [], key=lambda s: s.sequence_order)
        last_eta = None
        for s in reversed(stops):
            if s.eta is not None:
                last_eta = s.eta
                break
        if last_eta is None:
            return None
        raw = (last_eta + timedelta(minutes=20)).isoformat()
    try:
        from datetime import datetime

        base = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    delay = cumulative_delay_min(route)
    return (base + timedelta(minutes=delay)).isoformat()


def get_user_geofence_radius(db: Session, user_id: int) -> int:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    return row.geofence_radius_m if row else 150
