"""Orchestrate matrix + VRPTW + persist for a route."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from src.core.exceptions import AppError
from src.models.depot import Depot
from src.models.route import Route
from src.models.stop import Stop
from src.services import matrix as matrix_svc
from src.services.conflicts import ConflictReport, build_conflict_report
from src.services.customers import get_solver_service_min
from src.services.optimizer import (
    MAX_STOPS,
    StopInput,
    naive_duration_min,
    solve_vrptw,
)


def _stop_inputs(ordered: list[Stop]) -> list[StopInput]:
    inputs: list[StopInput] = []
    for s in ordered:
        # Prefer parking pin for travel geometry when learned
        lat = s.lat
        lng = s.lng
        if s.customer and s.customer.parking_lat is not None and s.customer.parking_sample_count >= 3:
            lat = s.customer.parking_lat
            lng = s.customer.parking_lng or lng
        service = get_solver_service_min(
            s.customer, s.tw_type, s.service_duration_min
        )
        inputs.append(
            StopInput(
                stop_id=s.id,
                lat=lat,
                lng=lng,
                service_min=service,
                tw_type=s.tw_type,
                tw_start=s.tw_start,
                tw_end=s.tw_end,
                priority=s.priority,
                locked=s.locked,
                sequence_order=s.sequence_order,
                customer_name=s.customer_name,
                status=s.status,
            )
        )
    return inputs

JERUSALEM = ZoneInfo("Asia/Jerusalem")


def _get_depot(db: Session) -> Depot:
    depot = db.query(Depot).order_by(Depot.id.asc()).first()
    if depot is None:
        raise AppError(
            code="depot_missing",
            message_he="לא הוגדר סניף (depot). הריצו seed.",
            status_code=500,
        )
    return depot


def _min_to_dt(route_date, minutes: int) -> datetime:
    base = datetime(
        route_date.year,
        route_date.month,
        route_date.day,
        tzinfo=JERUSALEM,
    )
    return base + timedelta(minutes=minutes)


async def optimize_route(db: Session, route: Route) -> dict[str, Any]:
    stops = list(route.stops or [])
    if len(stops) < 2:
        raise AppError(
            code="too_few_stops",
            message_he="צריך לפחות שני יעדים כדי לחשב מסלול.",
            status_code=400,
        )
    if len(stops) > MAX_STOPS:
        raise AppError(
            code="too_many_stops",
            message_he=(
                f"יותר מדי יעדים ({len(stops)}). המקסימום לסבב הוא {MAX_STOPS}. "
                "פצלו את הרשימה לשני סבבים."
            ),
            status_code=400,
        )

    depot = _get_depot(db)
    ordered = sorted(stops, key=lambda s: s.sequence_order)
    inputs = _stop_inputs(ordered)
    coords = [(depot.lat, depot.lng)] + [(inp.lat, inp.lng) for inp in inputs]

    matrices = await matrix_svc.build_matrices(
        db,
        route_id=route.id,
        coords=coords,
        departure_time=route.departure_time,
        route_date=datetime.combine(route.date, time(12, 0), tzinfo=JERUSALEM),
    )

    naive = naive_duration_min(
        matrices,
        inputs,
        route.departure_time,
        route.break_duration_min,
        route.break_window_start,
        route.break_window_end,
    )

    hist_seqs: list[list[int]] = []
    if route.variance_mode:
        from datetime import timedelta

        from src.models.route import Route as RouteModel

        past = (
            db.query(RouteModel)
            .filter(
                RouteModel.user_id == route.user_id,
                RouteModel.id != route.id,
                RouteModel.date >= route.date - timedelta(days=7),
            )
            .order_by(RouteModel.date.desc())
            .limit(7)
            .all()
        )
        for pr in past:
            hist_seqs.append(
                [s.id for s in sorted(pr.stops or [], key=lambda x: x.sequence_order)]
            )

    result = solve_vrptw(
        matrices=matrices,
        stops=inputs,
        departure_time=route.departure_time,
        break_duration_min=route.break_duration_min,
        break_window_start=route.break_window_start,
        break_window_end=route.break_window_end,
        deadline_buffer_min=route.deadline_buffer_min,
        vip_weight=route.vip_weight,
        variance_mode=route.variance_mode,
        allow_drop=False,
        historical_sequences=hist_seqs or None,
    )

    if not result.feasible:
        msg = (result.explanation or {}).get("message_he")
        if msg:
            return {
                "feasible": False,
                "conflicts": [{"type": "too_many_stops", "message_he": msg}],
                "options": [],
                "naive_duration_min": naive,
            }
        report = build_conflict_report(
            matrices=matrices,
            stops=inputs,
            departure_time=route.departure_time,
            break_duration_min=route.break_duration_min,
            break_window_start=route.break_window_start,
            break_window_end=route.break_window_end,
            deadline_buffer_min=route.deadline_buffer_min,
            vip_weight=route.vip_weight,
            variance_mode=route.variance_mode,
        )
        return _conflict_payload(report, naive)

    # Persist sequence + ETAs
    id_to_stop = {s.id: s for s in stops}
    for order, sid in enumerate(result.sequence_stop_ids):
        st = id_to_stop[sid]
        st.sequence_order = order
        mins = result.etas_min_from_midnight.get(sid)
        if mins is not None:
            st.eta = _min_to_dt(route.date, mins)

    savings = max(0, naive - (result.duration_min or 0))
    return_hm = (
        f"{result.return_min // 60:02d}:{result.return_min % 60:02d}"
        if result.return_min is not None
        else None
    )
    explanation = {
        **result.explanation,
        "depot_name": depot.name,
        "depot_address": depot.address,
        "return_hm": return_hm,
        "return_at": (
            _min_to_dt(route.date, result.return_min).isoformat()
            if result.return_min is not None
            else None
        ),
        "depot_he": (
            f"המסלול יוצא מ{depot.name} וחוזר לאותה נקודה"
            + (f" בשעה {return_hm}." if return_hm else ".")
            + " המטרה: זמן סיום הסבב הקצר ביותר עד החזרה לסניף — לא עד המשלוח האחרון."
        ),
        "naive_duration_min": naive,
        "optimized_duration_min": result.duration_min,
        "savings_min": savings,
        "savings_he": (
            f"סדר זה חוסך {savings} דקות עד החזרה לסניף מול הסדר שהוזן"
            if savings > 0
            else "הסדר האופטימלי דומה לסדר שהוזן בזמן החזרה לסניף"
        ),
        "variance_extra_min": result.variance_extra_min or 0,
        "variance_he": (
            f"מצב גיוון פעיל · +{result.variance_extra_min} דק'"
            if route.variance_mode and (result.variance_extra_min or 0) > 0
            else ("מצב גיוון פעיל" if route.variance_mode else None)
        ),
    }
    route.naive_duration_min = naive
    route.optimized_duration_min = result.duration_min
    route.solver_explanation = explanation
    route.optimized_at = datetime.now(JERUSALEM)
    route.status = "optimized"
    db.commit()

    return {
        "feasible": True,
        "route_id": route.id,
        "sequence_stop_ids": result.sequence_stop_ids,
        "etas": {
            str(k): _min_to_dt(route.date, v).isoformat()
            for k, v in result.etas_min_from_midnight.items()
        },
        "break_after_stop_id": result.break_after_stop_id,
        "break_start": (
            _min_to_dt(route.date, result.break_start_min).isoformat()
            if result.break_start_min is not None
            else None
        ),
        "return_at": (
            _min_to_dt(route.date, result.return_min).isoformat()
            if result.return_min is not None
            else None
        ),
        "naive_duration_min": naive,
        "optimized_duration_min": result.duration_min,
        "savings_min": savings,
        "variance_extra_min": result.variance_extra_min or 0,
        "solver_explanation": explanation,
        "conflicts": [],
        "options": [],
    }


def _conflict_payload(report: ConflictReport, naive: int) -> dict[str, Any]:
    return {
        "feasible": False,
        "naive_duration_min": naive,
        "optimized_duration_min": None,
        "savings_min": 0,
        "conflicts": report.conflicts,
        "options": [{"id": o.id, "label_he": o.label_he} for o in report.options],
        "dropped_names": report.dropped_names,
        "solver_explanation": {
            "message_he": report.conflicts[0]["message_he"] if report.conflicts else "",
        },
    }


async def apply_order_etas(
    db: Session,
    route: Route,
    stop_ids: list[int],
    *,
    set_status: str | None = "manual",
) -> dict[str, Any]:
    """Apply stop order and recompute ETAs from route.departure_time (no VRPTW)."""
    stops = list(route.stops or [])
    by_id = {s.id: s for s in stops}
    if set(stop_ids) != {s.id for s in stops}:
        raise AppError(
            code="bad_order",
            message_he="רשימת היעדים לא תואמת לסבב.",
            status_code=400,
        )

    depot = _get_depot(db)
    ordered_stops = [by_id[i] for i in stop_ids]
    coords = [(depot.lat, depot.lng)] + [(s.lat, s.lng) for s in ordered_stops]

    matrices = await matrix_svc.build_matrices(
        db,
        route_id=route.id,
        coords=coords,
        departure_time=route.departure_time,
        route_date=datetime.combine(route.date, time(12, 0), tzinfo=JERUSALEM),
    )

    from src.services.optimizer import simulate_route_duration, _tmin

    stop_indices = list(range(1, len(ordered_stops) + 1))
    services = [s.service_duration_min for s in ordered_stops]
    dep = _tmin(route.departure_time) or 0
    bw = (
        _tmin(route.break_window_start) or 690,
        _tmin(route.break_window_end) or 840,
    )
    return_min, arrivals, break_start = simulate_route_duration(
        matrices,
        stop_indices=stop_indices,
        services=services,
        departure_min=dep,
        break_duration=route.break_duration_min,
        break_window=bw,
        place_break=True,
    )

    warnings: list[str] = []
    for order, stop in enumerate(ordered_stops):
        stop.sequence_order = order
        arr = arrivals[order]
        stop.eta = _min_to_dt(route.date, arr)
        if stop.tw_type == "before" and stop.tw_end:
            limit = (_tmin(stop.tw_end) or 0) - route.deadline_buffer_min
            if arr > limit:
                warnings.append(
                    f"«{stop.customer_name}» צפוי באיחור "
                    f"({arr // 60:02d}:{arr % 60:02d} אחרי הדד-ליין)."
                )
        elif stop.tw_type == "window" and stop.tw_end:
            limit = (_tmin(stop.tw_end) or 0) - route.deadline_buffer_min
            if arr > limit:
                warnings.append(f"«{stop.customer_name}» חורג מחלון הזמן.")

    duration = return_min - dep
    route.optimized_duration_min = duration
    if set_status is not None:
        route.status = set_status
    explanation = dict(route.solver_explanation or {})
    explanation["return_hm"] = f"{return_min // 60:02d}:{return_min % 60:02d}"
    route.solver_explanation = explanation
    flag_modified(route, "solver_explanation")
    db.commit()

    return {
        "feasible": True,
        "route_id": route.id,
        "sequence_stop_ids": stop_ids,
        "etas": {str(s.id): s.eta.isoformat() if s.eta else None for s in ordered_stops},
        "break_start": (
            _min_to_dt(route.date, break_start).isoformat() if break_start else None
        ),
        "return_at": _min_to_dt(route.date, return_min).isoformat(),
        "duration_min": duration,
        "warnings_he": warnings,
    }


async def reorder_manual(
    db: Session,
    route: Route,
    stop_ids: list[int],
) -> dict[str, Any]:
    """Apply user order, recompute ETAs without re-optimizing."""
    return await apply_order_etas(db, route, stop_ids, set_status="manual")


def _pending_stops(route: Route) -> list[Stop]:
    return [
        s
        for s in sorted(route.stops or [], key=lambda x: x.sequence_order)
        if s.status == "pending"
    ]


async def _solve_remaining(
    db: Session,
    route: Route,
    *,
    origin_lat: float,
    origin_lng: float,
    departure: datetime,
    persist: bool,
) -> dict[str, Any]:
    from src.services.live import cumulative_delay_min
    from src.services.optimizer import _tmin

    pending = _pending_stops(route)
    if not pending:
        return {
            "feasible": True,
            "delay_min": cumulative_delay_min(route),
            "savings_min": 0,
            "message_he": "אין יעדים שנותרו לסידור מחדש.",
            "sequence_stop_ids": [],
            "etas": {},
            "return_at": None,
        }

    now_local = departure.astimezone(JERUSALEM)
    dep_time = time(now_local.hour, now_local.minute)
    bw_end = route.break_window_end
    include_break = True
    if bw_end and (now_local.hour * 60 + now_local.minute) > (
        bw_end.hour * 60 + bw_end.minute
    ):
        include_break = False

    coords = [(origin_lat, origin_lng)] + [(s.lat, s.lng) for s in pending]
    inputs = [
        StopInput(
            stop_id=s.id,
            lat=s.lat,
            lng=s.lng,
            service_min=s.service_duration_min,
            tw_type=s.tw_type,
            tw_start=s.tw_start,
            tw_end=s.tw_end,
            priority=s.priority,
            locked=s.locked,
            sequence_order=s.sequence_order,
            customer_name=s.customer_name,
            status=s.status,
        )
        for s in pending
    ]
    matrices = await matrix_svc.build_matrices(
        db,
        route_id=route.id,
        coords=coords,
        departure_time=dep_time,
        route_date=now_local,
        force_refresh=True,
    )
    current_order_ids = [s.id for s in pending]
    naive = naive_duration_min(
        matrices,
        inputs,
        dep_time,
        route.break_duration_min if include_break else 0,
        route.break_window_start,
        route.break_window_end,
    )
    result = solve_vrptw(
        matrices=matrices,
        stops=inputs,
        departure_time=dep_time,
        break_duration_min=route.break_duration_min if include_break else 0,
        break_window_start=route.break_window_start,
        break_window_end=route.break_window_end,
        deadline_buffer_min=route.deadline_buffer_min,
        vip_weight=route.vip_weight,
        variance_mode=False,
        allow_drop=False,
        include_break=include_break,
    )
    delay = cumulative_delay_min(route)
    if not result.feasible:
        return {
            "feasible": False,
            "delay_min": delay,
            "savings_min": 0,
            "message_he": "לא נמצא סידור מחדש חוקי ליעדים שנותרו.",
            "sequence_stop_ids": current_order_ids,
            "etas": {},
            "return_at": None,
        }

    savings = max(0, naive - (result.duration_min or 0))
    binding = [
        next((s.customer_name for s in pending if s.id == sid), "")
        for sid in result.binding_stop_ids
    ]
    binding = [n for n in binding if n]
    msg = (
        f"זוהה עיכוב של {delay} דק'. סידור מחדש יחסוך {savings} דק'"
        + (f" וישמור על הדד-ליין של {binding[0]}." if binding else ".")
        + " להחיל?"
    )
    etas = {
        str(k): _min_to_dt(route.date, v).isoformat()
        for k, v in result.etas_min_from_midnight.items()
    }
    if persist:
        # Keep done/skipped order prefix; append new pending sequence
        frozen = [
            s
            for s in sorted(route.stops or [], key=lambda x: x.sequence_order)
            if s.status in ("done", "skipped", "arrived")
        ]
        id_to = {s.id: s for s in route.stops or []}
        order = 0
        for s in frozen:
            s.sequence_order = order
            order += 1
        for sid in result.sequence_stop_ids:
            st = id_to[sid]
            st.sequence_order = order
            order += 1
            mins = result.etas_min_from_midnight.get(sid)
            if mins is not None:
                st.eta = _min_to_dt(route.date, mins)
        route.optimized_duration_min = result.duration_min
        db.commit()

    return {
        "feasible": True,
        "delay_min": delay,
        "savings_min": savings,
        "message_he": msg,
        "sequence_stop_ids": result.sequence_stop_ids,
        "etas": etas,
        "return_at": (
            _min_to_dt(route.date, result.return_min).isoformat()
            if result.return_min is not None
            else None
        ),
    }


async def propose_reoptimize(
    db: Session, route: Route, *, lat: float, lng: float
) -> dict[str, Any]:
    return await _solve_remaining(
        db, route, origin_lat=lat, origin_lng=lng, departure=datetime.now(JERUSALEM), persist=False
    )


async def apply_reoptimize(
    db: Session, route: Route, *, lat: float, lng: float
) -> dict[str, Any]:
    return await _solve_remaining(
        db, route, origin_lat=lat, origin_lng=lng, departure=datetime.now(JERUSALEM), persist=True
    )


async def what_if_add_stop(db: Session, route: Route, body) -> dict[str, Any]:
    """Estimate impact of adding a mid-day stop without committing."""
    from src.services.optimizer import _tmin, simulate_route_duration

    pending = _pending_stops(route)
    depot = _get_depot(db)
    origin = depot
    if body.current_lat is not None and body.current_lng is not None:
        origin_lat, origin_lng = body.current_lat, body.current_lng
    else:
        origin_lat, origin_lng = depot.lat, depot.lng

    now = datetime.now(JERUSALEM)
    dep = now.hour * 60 + now.minute
    base_coords = [(origin_lat, origin_lng)] + [(s.lat, s.lng) for s in pending]
    matrices = await matrix_svc.build_matrices(
        db,
        route_id=route.id,
        coords=base_coords + [(body.lat, body.lng)],
        departure_time=time(now.hour, now.minute),
        route_date=now,
        force_refresh=True,
    )
    # Without new stop
    services = [s.service_duration_min for s in pending]
    indices = list(range(1, len(pending) + 1))
    bw = (
        _tmin(route.break_window_start) or 690,
        _tmin(route.break_window_end) or 840,
    )
    ret0, arr0, _ = simulate_route_duration(
        matrices,
        stop_indices=indices,
        services=services,
        departure_min=dep,
        break_duration=route.break_duration_min,
        break_window=bw,
        place_break=dep < bw[1],
    )
    # With new stop at end of remaining (conservative what-if)
    new_idx = len(pending) + 1
    ret1, arr1, _ = simulate_route_duration(
        matrices,
        stop_indices=indices + [new_idx],
        services=services + [body.service_duration_min],
        departure_min=dep,
        break_duration=route.break_duration_min,
        break_window=bw,
        place_break=dep < bw[1],
    )
    added = max(0, (ret1 - dep) - (ret0 - dep))
    deadlines_ok = True
    binding: list[str] = []
    for s, arr in zip(pending, arr0):
        if s.tw_type == "before" and s.tw_end:
            limit = (_tmin(s.tw_end) or 0) - route.deadline_buffer_min
            # check with new route arrivals (same order + new at end) — use arr1 for existing
            pass
    for i, s in enumerate(pending):
        if s.tw_type in ("before", "window") and s.tw_end:
            limit = (_tmin(s.tw_end) or 0) - route.deadline_buffer_min
            if i < len(arr1) and arr1[i] > limit:
                deadlines_ok = False
                binding.append(s.customer_name)
    return_at = _min_to_dt(route.date, ret1).isoformat()
    ok_mark = "מובטח ✓" if deadlines_ok else "עלול להיפגע ✗"
    msg = (
        f"הוספת «{body.customer_name}» תוסיף {added} דק', "
        f"חזרה לסניף תידחה ל-{_min_to_dt(route.date, ret1).strftime('%H:%M')}, "
        f"הדד-ליינים {ok_mark}"
    )
    _ = origin
    return {
        "added_min": added,
        "new_return_at": return_at,
        "deadlines_ok": deadlines_ok,
        "message_he": msg,
        "binding_names": binding,
    }
