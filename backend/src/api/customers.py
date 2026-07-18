from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.schemas.customers import CustomerOut
from src.services import customers as customers_svc

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
def get_customers(
    q: str = Query(default="", max_length=120),
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[CustomerOut]:
    rows = customers_svc.list_customers(db, query=q, limit=limit)
    return [CustomerOut(**row) for row in rows]
