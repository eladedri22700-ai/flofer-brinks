from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.exceptions import AppError
from src.core.security import decode_access_token
from src.db.session import get_db
from src.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

SEED_USERNAME = "leader"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    token = credentials.credentials if credentials else None

    # Legacy Bearer "demo" only when DEMO_AUTH=true (local). Never share one
    # anonymous identity in production — each pilot must login for isolation.
    if token == "demo" and settings.demo_auth:
        user = db.query(User).filter(User.username == SEED_USERNAME).first()
        if user is None:
            raise AppError(
                code="seed_missing",
                message_he="משתמש הדגמה חסר. הריצו python -m src.seed",
                status_code=500,
            )
        return user

    if not token:
        raise AppError(
            code="unauthorized",
            message_he="נדרשת התחברות למערכת",
            status_code=401,
        )

    user_id = decode_access_token(token)
    if user_id is None:
        raise AppError(
            code="invalid_token",
            message_he="ההתחברות פגה. התחברו מחדש.",
            status_code=401,
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise AppError(
            code="user_not_found",
            message_he="המשתמש לא נמצא",
            status_code=401,
        )
    return user
