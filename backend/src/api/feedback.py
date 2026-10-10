"""Field notes endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.services import feedback as feedback_svc

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackBody(BaseModel):
    text: str = Field(min_length=2, max_length=2000)
    category: str = "field_data"  # field_data | bug | idea | other
    route_id: int | None = None
    stop_id: int | None = None
    screen: str | None = None
    app_version: str | None = None


@router.post("")
async def post_feedback(
    body: FeedbackBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return await feedback_svc.submit_feedback(
        db,
        user,
        text=body.text,
        category=body.category,
        route_id=body.route_id,
        stop_id=body.stop_id,
        screen=body.screen,
        app_version=body.app_version,
    )


@router.get("")
def get_feedback(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    return feedback_svc.list_feedback(db, user)
