"""Live Mode HTTP endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from src.api.deps import get_current_user
from src.core.config import get_settings
from src.core.exceptions import AppError
from src.db.session import get_db
from src.models.stop import Stop
from src.models.user import User
from src.schemas.live import (
    CompleteStopBody,
    GpsBody,
    ReoptimizeProposalOut,
    ReoptimizeProposeBody,
    RouteEventBody,
    SkipStopBody,
    WhatIfBody,
    WhatIfOut,
    WorkDayPatch,
)
from src.schemas.routes import RouteOut
from src.services import live as live_svc
from src.services import telegram_notify
from src.services.optimize_service import (
    propose_reoptimize,
    apply_reoptimize,
    what_if_add_stop,
)
from src.services.routes import get_route_for_user, stop_to_out

router = APIRouter(tags=["live"])


def _route_out(route) -> RouteOut:
    from src.api.routes import _route_out as base

    return base(route)


def _get_stop_for_user(db: Session, stop_id: int, user: User) -> tuple[Stop, object]:
    stop = (
        db.query(Stop)
        .options(joinedload(Stop.customer), joinedload(Stop.route))
        .filter(Stop.id == stop_id)
        .first()
    )
    if stop is None:
        raise AppError(code="stop_not_found", message_he="היעד לא נמצא", status_code=404)
    route = get_route_for_user(db, stop.route_id, user.id)
    return stop, route


@router.post("/routes/{route_id}/start", response_model=RouteOut)
async def post_start(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = get_route_for_user(db, route_id, user.id)
    await live_svc.start_route(db, route, user.id)
    route = get_route_for_user(db, route_id, user.id)
    return _route_out(route)


@router.post("/stops/{stop_id}/arrive")
async def post_arrive(
    stop_id: int,
    body: GpsBody | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    stop, _route = _get_stop_for_user(db, stop_id, user)
    body = body or GpsBody()
    stop = live_svc.mark_arrive(db, stop, lat=body.lat, lng=body.lng)
    await telegram_notify.notify_event(
        db,
        user.id,
        kind="arrive",
        customer_name=stop.customer_name,
        app_base_url=get_settings().app_public_url,
    )
    return {"ok": True, "stop": stop_to_out(stop).model_dump(mode="json")}


class ApproachBody(BaseModel):
    distance_m: float | None = None
    stop_id: int | None = None


@router.post("/routes/{route_id}/notify-approach")
async def post_notify_approach(
    route_id: int,
    body: ApproachBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    route = get_route_for_user(db, route_id, user.id)
    name = None
    if body.stop_id:
        stop = next((s for s in (route.stops or []) if s.id == body.stop_id), None)
        if stop:
            name = stop.customer_name
    sent = await telegram_notify.notify_event(
        db,
        user.id,
        kind="approach",
        customer_name=name,
        extra={"distance_m": body.distance_m},
        app_base_url=get_settings().app_public_url,
    )
    live_svc.log_event(
        db,
        route_id,
        "approach",
        {"stop_id": body.stop_id, "distance_m": body.distance_m, "telegram": sent},
    )
    return {"ok": True, "telegram_sent": sent}


@router.post("/stops/{stop_id}/complete")
def post_complete(
    stop_id: int,
    body: CompleteStopBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    stop, route = _get_stop_for_user(db, stop_id, user)
    # reload with stops for leg sample
    route = get_route_for_user(db, route.id, user.id)
    stop = next(s for s in route.stops if s.id == stop_id)
    result = live_svc.complete_stop(
        db,
        route,
        stop,
        exception_code=body.exception_code,
        exception_note=body.exception_note,
        lat=body.lat,
        lng=body.lng,
        departure_at=body.departure_at,
    )
    return result


@router.post("/stops/{stop_id}/skip")
def post_skip(
    stop_id: int,
    body: SkipStopBody | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    stop, route = _get_stop_for_user(db, stop_id, user)
    body = body or SkipStopBody()
    return live_svc.skip_stop(db, route, stop, note=body.note)


@router.post("/routes/{route_id}/work-day")
def post_work_day(
    route_id: int,
    body: WorkDayPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    route = get_route_for_user(db, route_id, user.id)
    if body.event in ("exit", "enter"):
        wd = live_svc.depot_geofence_event(
            db, route, user.id, event=body.event, lat=None, lng=None
        )
    else:
        wd = live_svc.patch_work_day(
            db,
            route,
            user.id,
            start_at=body.start_at,
            end_at=body.end_at,
            note=body.note,
        )
    return {
        "id": wd.id,
        "start_at": wd.start_at.isoformat() if wd.start_at else None,
        "end_at": wd.end_at.isoformat() if wd.end_at else None,
        "total_min": wd.total_min,
        "manually_edited": wd.manually_edited,
    }


@router.post("/routes/{route_id}/events")
def post_event(
    route_id: int,
    body: RouteEventBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    get_route_for_user(db, route_id, user.id)
    ev = live_svc.log_event(db, route_id, body.type, body.payload)
    return {"id": ev.id, "type": ev.type, "created_at": ev.created_at.isoformat()}


@router.get("/routes/{route_id}/delay")
def get_delay(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    route = get_route_for_user(db, route_id, user.id)
    delay = live_svc.cumulative_delay_min(route)
    return {
        "delay_min": delay,
        "should_propose": delay > 15,
        "geofence_radius_m": live_svc.get_user_geofence_radius(db, user.id),
        "adjusted_return_at": live_svc.adjusted_return_iso(route),
    }


@router.post("/routes/{route_id}/reoptimize-propose", response_model=ReoptimizeProposalOut)
async def post_reoptimize_propose(
    route_id: int,
    body: ReoptimizeProposeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReoptimizeProposalOut:
    route = get_route_for_user(db, route_id, user.id)
    result = await propose_reoptimize(db, route, lat=body.lat, lng=body.lng)
    if result.get("feasible") and (result.get("savings_min") or 0) > 0:
        await telegram_notify.notify_event(
            db,
            user.id,
            kind="reopt",
            extra={"message_he": result.get("message_he")},
            app_base_url=get_settings().app_public_url,
        )
    return ReoptimizeProposalOut.model_validate(result)


@router.post("/routes/{route_id}/reoptimize-apply", response_model=RouteOut)
async def post_reoptimize_apply(
    route_id: int,
    body: ReoptimizeProposeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = get_route_for_user(db, route_id, user.id)
    await apply_reoptimize(db, route, lat=body.lat, lng=body.lng)
    route = get_route_for_user(db, route_id, user.id)
    return _route_out(route)


@router.post("/routes/{route_id}/what-if", response_model=WhatIfOut)
async def post_what_if(
    route_id: int,
    body: WhatIfBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WhatIfOut:
    route = get_route_for_user(db, route_id, user.id)
    result = await what_if_add_stop(db, route, body)
    return WhatIfOut.model_validate(result)
