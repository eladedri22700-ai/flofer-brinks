from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.db.session import get_db
from src.models.user import User
from src.schemas.customers import CustomerCreate, CustomerOut
from src.services import customers as customers_svc
from src.services.customers import get_service_estimate

router = APIRouter(prefix="/customers", tags=["customers"])


def _to_out(db: Session, customer) -> CustomerOut:
    minutes, source = get_service_estimate(customer)
    return CustomerOut(
        id=customer.id,
        name=customer.name,
        address=customers_svc.display_address(db, customer),
        lat=customer.lat,
        lng=customer.lng,
        category=customer.category,
        service_duration_min=minutes,
        service_estimate_source=source,
        service_sample_count=customer.service_sample_count,
        geocode_confidence=customer.geocode_confidence,
    )


@router.get("", response_model=list[CustomerOut])
def get_customers(
    q: str = Query(default="", max_length=120),
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[CustomerOut]:
    rows = customers_svc.list_customers(db, query=q, limit=limit)
    return [CustomerOut(**row) for row in rows]


@router.post("", response_model=CustomerOut)
async def post_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> CustomerOut:
    customer = await customers_svc.create_customer_manual(
        db,
        name=body.name,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        place_id=body.place_id,
        category=body.category,
        geocode_confidence=body.geocode_confidence,
    )
    return _to_out(db, customer)
