"""Live forecast — re-estimate every remaining ETA and the return to the depot.

Runs from the crew's real position and the real clock (not the morning plan),
using the routing provider plus learned corrections. Called:
- by the app every couple of minutes while a round is open,
- after every arrive / complete / reorder,
- by the server scheduler while the app is closed (last known position).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from src.models.depot import Depot
from src.models.route import Route
from src.models.stop import Stop
from src.services import matrix as matrix_svc
from src.services import traffic
from src.services.matrix_learning import hour_to_bucket, raw_matrix

JERUSALEM = ZoneInfo("Asia/Jerusalem")
MIN_INTERVAL_S = 60
POSITION_FRESH_MIN = 30
# Real-time traffic is the best predictor for the next hour; beyond that the
# learned time-of-day pattern is more reliable than today's momentary jam.
LIVE_TRAFFIC_HORIZON_MIN = 60


def _now() -> datetime:
    return datetime.now(JERUSALEM)


def _depot(db: Session) -> Depot | None:
    return db.query(Depot).order_by(Depot.id.asc()).first()


def _min_to_dt(route_date, minutes: int) -> datetime:
    base = datetime(route_date.year, route_date.month, route_date.day, tzinfo=JERUSALEM)
    return base + timedelta(minutes=minutes)


def _tmin(t: time | None) -> int | None:
    return None if t is None else t.hour * 60 + t.minute


def _clock_hm(minutes: int) -> str:
    m = minutes % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def assign_planned_legs(
    matrices: dict[str, list[list[int]]],
    stops_in_order: list[Stop],
    nodes: list[int],
    origin_node: int = 0,
) -> None:
    """Store the raw provider minutes of each leg the plan uses (learning baseline)."""
    prev = origin_node
    for stop, node in zip(stops_in_order, nodes):
        hour = stop.eta.astimezone(JERUSALEM).hour if stop.eta else 9
        stop.planned_leg_raw_min = float(raw_matrix(matrices, hour_to_bucket(hour))[prev][node])
        prev = node


def _break_taken(db: Session, route: Route) -> bool:
    from src.models.work_day import WorkDay

    wd = db.query(WorkDay).filter(WorkDay.route_id == route.id).first()
    return bool(wd and (wd.break_min or 0) > 0)


def remember_position(route: Route, lat: float | None, lng: float | None) -> None:
    if lat is None or lng is None:
        return
    route.last_lat, route.last_lng, route.last_pos_at = lat, lng, _now()


def _origin(db: Session, route: Route, ordered: list[Stop]) -> tuple[float, float]:
    now = _now()
    if (
        route.last_lat is not None
        and route.last_pos_at is not None
        and now - route.last_pos_at.astimezone(JERUSALEM) < timedelta(minutes=POSITION_FRESH_MIN)
    ):
        return route.last_lat, route.last_lng  # type: ignore[return-value]
    closed = [s for s in ordered if s.status in ("done", "skipped")]
    if closed:
        last = closed[-1]
        return (last.actual_park_lat or last.lat, last.actual_park_lng or last.lng)
    depot = _depot(db)
    return (depot.lat, depot.lng) if depot else (ordered[0].lat, ordered[0].lng)


async def live_reforecast(
    db: Session,
    route: Route,
    *,
    lat: float | None = None,
    lng: float | None = None,
    force: bool = False,
) -> dict[str, Any] | None:
    """Recompute ETAs for open stops from 'now'. Returns the forecast or None if skipped."""
    now = _now()
    remember_position(route, lat, lng)
    if route.status != "in_progress":
        db.commit()
        return None
    if (
        not force
        and route.live_eta_at is not None
        and (now - route.live_eta_at.astimezone(JERUSALEM)).total_seconds() < MIN_INTERVAL_S
    ):
        db.commit()
        return None

    ordered = sorted(route.stops or [], key=lambda s: s.sequence_order)
    depot = _depot(db)
    if depot is None:
        return None
    from src.services.optimize_service import repair_fallback_locations

    await repair_fallback_locations(db, ordered)
    arrived = next((s for s in ordered if s.status == "arrived"), None)
    pending = [s for s in ordered if s.status == "pending"]

    now_min = now.hour * 60 + now.minute
    # Minutes-from-midnight of the route date (rounds can cross midnight)
    day_offset = (now.date() - route.date).days * 24 * 60
    t = now_min + day_offset

    if arrived is not None:
        origin = (arrived.lat, arrived.lng)
        started = arrived.actual_arrival.astimezone(JERUSALEM) if arrived.actual_arrival else now
        started_min = started.hour * 60 + started.minute + (started.date() - route.date).days * 1440
        t = max(t, started_min + arrived.service_duration_min)
    else:
        origin = _origin(db, route, ordered)

    coords = [origin] + [(s.lat, s.lng) for s in pending] + [(depot.lat, depot.lng)]
    matrices = await matrix_svc.build_matrices(
        db,
        route_id=route.id,
        coords=coords,
        departure_time=time(now.hour, now.minute),
        route_date=now,
        force_refresh=True,
        allow_google=False,
    )

    live = await traffic.live_legs(coords)
    t_start = t

    # Lunch break: plan it like the morning plan did, unless already taken or missed.
    bw0 = _tmin(route.break_window_start) or 690
    bw1 = _tmin(route.break_window_end) or 840
    break_left = route.break_duration_min > 0 and not _break_taken(db, route) and t <= bw1

    prev = 0
    for k, stop in enumerate(pending, start=1):
        if break_left and t >= bw0 and (k > 1 or arrived is not None):
            if t <= bw1:
                t += route.break_duration_min
            break_left = False
        bucket = hour_to_bucket((t // 60) % 24)
        travel = matrices[bucket][prev][k]
        if live is not None and t - t_start <= LIVE_TRAFFIC_HORIZON_MIN:
            travel = live[k - 1].minutes
        # The first leg may start mid-drive (GPS); keep its full-leg baseline for learning.
        if k > 1 or arrived is not None:
            stop.planned_leg_raw_min = float(raw_matrix(matrices, bucket)[prev][k])
        arr = t + travel
        tw_start = _tmin(stop.tw_start)
        if stop.tw_type in ("after", "window") and tw_start is not None:
            arr = max(arr, tw_start)
        stop.eta = _min_to_dt(route.date, arr)
        t = arr + stop.service_duration_min
        prev = k
    if break_left and pending and t >= bw0:
        t += route.break_duration_min  # still out when lunch window opened
    bucket = hour_to_bucket((t // 60) % 24)
    back = matrices[bucket][prev][len(coords) - 1]
    if live is not None and t - t_start <= LIVE_TRAFFIC_HORIZON_MIN:
        back = live[-1].minutes
    return_min = t + back

    expl = dict(route.solver_explanation or {})
    return_at = _min_to_dt(route.date, return_min)
    expl["return_at"] = return_at.isoformat()
    expl["return_hm"] = _clock_hm(return_min)
    expl["live_updated_at"] = now.isoformat()
    expl["traffic_source"] = "live" if live is not None else "learned"
    expl["next_leg_traffic_min"] = live[0].traffic_delay_min if live else None
    planned = expl.get("planned_return_at")
    if planned:
        try:
            delta = (return_at - datetime.fromisoformat(planned)).total_seconds() / 60
            expl["return_delta_min"] = int(round(delta))
        except ValueError:
            pass
    route.solver_explanation = expl
    flag_modified(route, "solver_explanation")
    route.live_eta_at = now
    db.commit()
    return {
        "return_at": return_at.isoformat(),
        "return_delta_min": expl.get("return_delta_min"),
        "etas": {str(s.id): s.eta.isoformat() if s.eta else None for s in pending},
        "updated_at": now.isoformat(),
    }


def freeze_plan_baseline(route: Route) -> None:
    """At round start: remember the plan so delays and learning compare against it."""
    for s in route.stops or []:
        if s.status == "pending":
            s.planned_eta = s.eta
    expl = dict(route.solver_explanation or {})
    if expl.get("return_at"):
        expl["planned_return_at"] = expl["return_at"]
    route.solver_explanation = expl
    flag_modified(route, "solver_explanation")
