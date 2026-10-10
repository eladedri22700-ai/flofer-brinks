import time
from collections import defaultdict, deque

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.exceptions import AppError
from src.core.security import create_access_token, hash_password, verify_password
from src.models.user import User
from src.schemas.auth import TokenResponse, UserOut


# Simple in-process brute-force guard: max failed attempts per username / window.
_FAIL_WINDOW_S = 300
_FAIL_MAX = 8
_failures: dict[str, deque[float]] = defaultdict(deque)


def _too_many_failures(key: str) -> bool:
    now = time.monotonic()
    q = _failures[key]
    while q and now - q[0] > _FAIL_WINDOW_S:
        q.popleft()
    return len(q) >= _FAIL_MAX


def authenticate_user(db: Session, username: str, password: str) -> TokenResponse:
    key = username.strip()
    guard_key = key.lower()
    if _too_many_failures(guard_key):
        raise AppError(
            code="too_many_attempts",
            message_he="יותר מדי ניסיונות כניסה. המתינו 5 דקות ונסו שוב.",
            status_code=429,
        )
    user = (
        db.query(User)
        .filter(func.lower(User.username) == key.lower())
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        _failures[guard_key].append(time.monotonic())
        raise AppError(
            code="invalid_credentials",
            message_he="שם משתמש או סיסמה שגויים",
            status_code=401,
        )
    _failures.pop(guard_key, None)
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise AppError(
            code="invalid_credentials",
            message_he="הסיסמה הנוכחית שגויה",
            status_code=400,
        )
    new = new.strip()
    if len(new) < 6:
        raise AppError(
            code="weak_password",
            message_he="סיסמה חדשה חייבת להכיל לפחות 6 תווים",
            status_code=422,
        )
    user.password_hash = hash_password(new)
    db.commit()
