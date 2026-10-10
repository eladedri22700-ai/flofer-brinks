"""Web Push subscription endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.services import push

router = APIRouter(prefix="/push", tags=["push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeBody(BaseModel):
    endpoint: str
    keys: PushKeys


class EndpointBody(BaseModel):
    endpoint: str


@router.get("/public-key")
def get_public_key() -> dict:
    return {"public_key": push.public_key_b64()}


@router.post("/subscribe")
def post_subscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    push.subscribe(db, user.id, body.endpoint, body.keys.p256dh, body.keys.auth)
    return {"ok": True}


@router.post("/unsubscribe")
def post_unsubscribe(
    body: EndpointBody,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    push.unsubscribe(db, body.endpoint)
    return {"ok": True}


@router.post("/test")
async def post_test(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    sent = await push.send_to_user(
        db,
        user.id,
        title="FLOFER BRINKS · בדיקת התראה",
        body="מעולה — התראות יגיעו גם כשהאפליקציה סגורה.",
        url="/app/settings",
        tag="test",
    )
    return {"ok": sent > 0, "devices": sent}
