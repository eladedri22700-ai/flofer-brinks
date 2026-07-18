from datetime import time as dtime

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.core.exceptions import AppError
from src.db.session import get_db
from src.models.stop import Stop
from src.models.user import User
from src.schemas.customers import AddFromCustomersBody
from src.schemas.routes import (
    DraftStop,
    OptimizeRequest,
    OptimizeResultOut,
    ReorderManualRequest,
    RouteCreate,
    RouteOut,
    RouteUpdate,
    StopBulkCreate,
    StopCreate,
    StopOut,
    StopReorder,
    StopUpdate,
)
from src.services import ocr
from src.services.file_import import parse_stops_file
from src.services.optimize_service import optimize_route, reorder_manual
from src.services.routes import (
    add_stop,
    add_stops_from_customers,
    create_route,
    delete_stop,
    get_route_for_user,
    get_today_route,
    reorder_stops,
    stop_to_out,
    update_stop,
)

router = APIRouter(tags=["routes"])

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_IMAGE = 10 * 1024 * 1024


def _route_out(route) -> RouteOut:
    stops = sorted(route.stops or [], key=lambda s: s.sequence_order)
    return RouteOut(
        id=route.id,
        user_id=route.user_id,
        date=route.date,
        status=route.status,
        departure_time=route.departure_time,
        break_duration_min=route.break_duration_min,
        break_window_start=route.break_window_start,
        break_window_end=route.break_window_end,
        deadline_buffer_min=route.deadline_buffer_min,
        vip_weight=route.vip_weight,
        variance_mode=route.variance_mode,
        is_demo=bool(getattr(route, "is_demo", False)),
        created_at=route.created_at,
        optimized_at=route.optimized_at,
        naive_duration_min=route.naive_duration_min,
        optimized_duration_min=route.optimized_duration_min,
        solver_explanation=route.solver_explanation,
        variance_extra_min=(
            (route.solver_explanation or {}).get("variance_extra_min")
            if isinstance(route.solver_explanation, dict)
            else None
        ),
        stops=[stop_to_out(s) for s in stops],
    )


@router.post("/routes", response_model=RouteOut)
def post_route(
    body: RouteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = create_route(db, user.id, body)
    return _route_out(route)


@router.get("/routes/today", response_model=RouteOut | None)
def get_today(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut | None:
    route = get_today_route(db, user.id)
    return _route_out(route) if route else None


@router.patch("/routes/{route_id}", response_model=RouteOut)
def patch_route(
    route_id: int,
    body: RouteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = get_route_for_user(db, route_id, user.id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(route, key, value)
    db.commit()
    route = get_route_for_user(db, route_id, user.id)
    return _route_out(route)


@router.post("/routes/{route_id}/stops", response_model=StopOut)
async def post_stop(
    route_id: int,
    body: StopCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StopOut:
    route = get_route_for_user(db, route_id, user.id)
    stop = await add_stop(db, route, body)
    return stop_to_out(stop)


@router.post("/routes/{route_id}/stops/from-customers", response_model=list[StopOut])
def post_stops_from_customers(
    route_id: int,
    body: AddFromCustomersBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[StopOut]:
    route = get_route_for_user(db, route_id, user.id)
    stops = add_stops_from_customers(db, route, body.customer_ids)
    return [stop_to_out(s) for s in stops]


@router.post("/routes/{route_id}/stops/bulk", response_model=list[StopOut])
async def post_stops_bulk(
    route_id: int,
    body: StopBulkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[StopOut]:
    from src.services.optimizer import MAX_STOPS

    route = get_route_for_user(db, route_id, user.id)
    existing = len(route.stops or [])
    incoming = len(body.stops)
    if existing + incoming > MAX_STOPS:
        raise AppError(
            code="too_many_stops",
            message_he=(
                f"לא ניתן להוסיף {incoming} יעדים "
                f"(יש כבר {existing}; מקסימום {MAX_STOPS} לסבב)."
            ),
            status_code=400,
        )
    created: list[StopOut] = []
    for item in body.stops:
        stop = await add_stop(db, route, item)
        created.append(stop_to_out(stop))
        route = get_route_for_user(db, route_id, user.id)
    return created


@router.patch("/stops/{stop_id}", response_model=StopOut)
def patch_stop(
    stop_id: int,
    body: StopUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StopOut:
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if stop is None:
        raise AppError(code="stop_not_found", message_he="היעד לא נמצא", status_code=404)
    get_route_for_user(db, stop.route_id, user.id)
    stop = update_stop(db, stop, body)
    return stop_to_out(stop)


@router.delete("/stops/{stop_id}")
def remove_stop(
    stop_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if stop is None:
        raise AppError(code="stop_not_found", message_he="היעד לא נמצא", status_code=404)
    get_route_for_user(db, stop.route_id, user.id)
    delete_stop(db, stop)
    return {"ok": True}


@router.patch("/routes/{route_id}/stops/reorder", response_model=list[StopOut])
def patch_reorder(
    route_id: int,
    body: StopReorder,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[StopOut]:
    route = get_route_for_user(db, route_id, user.id)
    stops = reorder_stops(db, route, body.stop_ids)
    return [stop_to_out(s) for s in stops]


@router.post("/routes/{route_id}/optimize", response_model=OptimizeResultOut)
async def post_optimize(
    route_id: int,
    body: OptimizeRequest | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OptimizeResultOut:
    route = get_route_for_user(db, route_id, user.id)
    option = (body.resolve_option if body else None) or None
    if option == "relax_buffer":
        route.deadline_buffer_min = 0
        db.commit()
        route = get_route_for_user(db, route_id, user.id)
    elif option in ("widen_windows", "delay_second"):
        for s in route.stops or []:
            if s.tw_type in ("before", "window") and s.tw_end:
                total = s.tw_end.hour * 60 + s.tw_end.minute + 30
                s.tw_end = dtime(min(23, total // 60), total % 60)
        db.commit()
        route = get_route_for_user(db, route_id, user.id)
    elif option == "drop_stop":
        # drop the first stop with a hard deadline (best-effort)
        candidate = next(
            (
                s
                for s in sorted(route.stops or [], key=lambda x: x.sequence_order)
                if s.tw_type in ("before", "window")
            ),
            None,
        )
        if candidate is not None:
            delete_stop(db, candidate)
            route = get_route_for_user(db, route_id, user.id)
    result = await optimize_route(db, route)
    return OptimizeResultOut.model_validate(result)


@router.post("/routes/{route_id}/reorder-manual", response_model=OptimizeResultOut)
async def post_reorder_manual(
    route_id: int,
    body: ReorderManualRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OptimizeResultOut:
    route = get_route_for_user(db, route_id, user.id)
    result = await reorder_manual(db, route, body.stop_ids)
    return OptimizeResultOut.model_validate(result)


@router.post("/routes/{route_id}/import-file", response_model=list[DraftStop])
async def import_file(
    route_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DraftStop]:
    get_route_for_user(db, route_id, user.id)
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise AppError(
            code="file_too_large",
            message_he="הקובץ גדול מדי (מקסימום 5MB).",
            status_code=400,
        )
    drafts = parse_stops_file(file.filename or "file.csv", raw)
    return [DraftStop.model_validate(d) for d in drafts]


@router.post("/stops/extract-from-image", response_model=list[DraftStop])
async def extract_image(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
) -> list[DraftStop]:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE and not (file.filename or "").lower().endswith(
        (".jpg", ".jpeg", ".png", ".webp")
    ):
        raise AppError(
            code="invalid_image_type",
            message_he="נתמכים רק קבצי תמונה jpeg, png או webp.",
            status_code=400,
        )
    raw = await file.read()
    if len(raw) > MAX_IMAGE:
        raise AppError(
            code="image_too_large",
            message_he="התמונה גדולה מדי (מקסימום 10MB).",
            status_code=400,
        )
    drafts = await ocr.extract_from_image(raw, content_type or "image/jpeg")
    return [DraftStop.model_validate(d) for d in drafts]
