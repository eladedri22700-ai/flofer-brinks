from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db.session import get_db

router = APIRouter(tags=["health"])


# HEAD too: uptime monitors (UptimeRobot) probe with HEAD by default
@router.api_route("/health", methods=["GET", "HEAD"])
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
