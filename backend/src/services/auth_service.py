from sqlalchemy import func
from sqlalchemy.orm import Session

from src.core.exceptions import AppError
from src.core.security import create_access_token, verify_password
from src.models.user import User
from src.schemas.auth import TokenResponse, UserOut


def authenticate_user(db: Session, username: str, password: str) -> TokenResponse:
    key = username.strip()
    user = (
        db.query(User)
        .filter(func.lower(User.username) == key.lower())
        .first()
    )
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(
            code="invalid_credentials",
            message_he="שם משתמש או סיסמה שגויים",
            status_code=401,
        )
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )
