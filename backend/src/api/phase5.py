"""Hours, history, analytics, demo HTTP API."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.api.routes import _route_out
from src.db.session import get_db
from src.models.user import User
from src.schemas.routes import RouteOut
from src.services import demo as demo_svc
from src.services import history as history_svc
from src.services import hours as hours_svc
from src.services.routes import get_route_for_user

router = APIRouter(tags=["phase5"])


class WorkDayPatchBody(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    note: str | None = None


@router.get("/hours/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return hours_svc.dashboard(db, user.id)


@router.get("/hours/days")
def get_days(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    return hours_svc.list_days(db, user.id, month)


@router.patch("/hours/days/{day_id}")
def patch_day(
    day_id: int,
    body: WorkDayPatchBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return hours_svc.patch_day(
        db, user.id, day_id, start_at=body.start_at, end_at=body.end_at, note=body.note
    )


@router.get("/hours/export")
def export_hours(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    data, media, filename = hours_svc.export_month(db, user.id, month, format)
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/routes/history")
def routes_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    return history_svc.list_history(db, user.id)


@router.get("/routes/{route_id}/detail", response_model=RouteOut)
def route_detail(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = get_route_for_user(db, route_id, user.id)
    return _route_out(route)


@router.get("/routes/{route_id}/compare")
def route_compare(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Plan vs actual per stop — for history detail."""
    route = get_route_for_user(db, route_id, user.id)
    return history_svc.plan_vs_actual(db, route)


@router.post("/routes/{route_id}/duplicate", response_model=RouteOut)
def route_duplicate(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RouteOut:
    route = get_route_for_user(db, route_id, user.id)
    new_r = history_svc.duplicate_route(db, route, user.id)
    return _route_out(new_r)


@router.get("/routes/{route_id}/summary")
def route_summary(
    route_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    route = get_route_for_user(db, route_id, user.id)
    return history_svc.route_summary(db, route)


@router.get("/analytics/accuracy")
def accuracy(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return history_svc.accuracy_report(db, user.id)


@router.post("/settings/demo/enable")
def demo_enable(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return demo_svc.enable_demo(db, user.id)


@router.post("/settings/demo/practice")
def demo_practice(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Hands-on guided tour: demo data + empty planning route for today."""
    return demo_svc.prepare_tour_practice(db, user.id)


@router.post("/settings/demo/disable")
def demo_disable(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return demo_svc.disable_demo(db, user.id)
