"""Customer registry: normalize, find-or-create, service estimates."""

from __future__ import annotations

import re

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.models.customer import Customer
from src.models.stop import Stop

CATEGORY_DEFAULTS: dict[str, int] = {
    "bank_branch": 15,
    "atm": 8,
    "retail_chain": 12,
    "private_business": 10,
    "other": 10,
}

DEMO_NAME_PREFIX = "[דמו] "

_STREET_ALIASES = (
    (r"\bרח['׳]?\b", "רחוב"),
    (r"\bשד['׳]?\b", "שדרות"),
    (r"\bבנ['׳]?\b", "בני"),
)


def normalize_address(raw: str) -> str:
    text = (raw or "").strip()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("״", '"').replace("׳", "'")
    lower = text.casefold()
    for pattern, replacement in _STREET_ALIASES:
        lower = re.sub(pattern, replacement, lower)
    lower = re.sub(r"[.,;:]+", " ", lower)
    lower = re.sub(r"\s+", " ", lower).strip()
    return lower


def get_service_estimate(customer: Customer) -> tuple[int, str]:
    if customer.service_sample_count >= 3 and customer.learned_service_min is not None:
        return int(round(customer.learned_service_min)), "learned"
    if customer.category in CATEGORY_DEFAULTS:
        return CATEGORY_DEFAULTS[customer.category], "category"
    if customer.default_service_min is not None:
        return customer.default_service_min, "default"
    return CATEGORY_DEFAULTS["other"], "default"


def get_solver_service_min(customer: Customer | None, tw_type: str, fallback: int) -> int:
    """
    Risk-aware planning duration for the solver.
    Deadline stops ('before'/'window') use learned_service_p80 (realistic worst case).
    Non-deadline stops use the learned median. Never blur this distinction.
    """
    if customer is None or customer.service_sample_count < 3:
        return fallback
    if tw_type in ("before", "window"):
        if customer.learned_service_p80 is not None:
            return max(1, int(round(customer.learned_service_p80)))
    if customer.learned_service_min is not None:
        return max(1, int(round(customer.learned_service_min)))
    return fallback


def find_or_create_customer(
    db: Session,
    *,
    name: str,
    address: str,
    lat: float,
    lng: float,
    category: str = "other",
    geocode_confidence: float | None = None,
) -> Customer:
    normalized = normalize_address(address)
    existing = (
        db.query(Customer)
        .filter(
            Customer.normalized_address == normalized,
            Customer.name == name.strip(),
        )
        .first()
    )
    if existing:
        # Keep registry fresh when the same customer is re-used
        existing.lat = lat
        existing.lng = lng
        if geocode_confidence is not None:
            existing.geocode_confidence = geocode_confidence
        if category in CATEGORY_DEFAULTS:
            existing.category = category
        return existing

    customer = Customer(
        name=name.strip(),
        normalized_address=normalized,
        lat=lat,
        lng=lng,
        category=category if category in CATEGORY_DEFAULTS else "other",
        default_service_min=CATEGORY_DEFAULTS.get(category, 10),
        geocode_confidence=geocode_confidence,
    )
    db.add(customer)
    db.flush()
    return customer


def display_address(db: Session, customer: Customer) -> str:
    last = (
        db.query(Stop.address)
        .filter(Stop.customer_id == customer.id)
        .order_by(Stop.id.desc())
        .first()
    )
    if last and last[0]:
        return str(last[0])
    return customer.normalized_address


def list_customers(
    db: Session,
    *,
    query: str = "",
    limit: int = 80,
    include_demo: bool = False,
) -> list[dict]:
    q = db.query(Customer)
    if not include_demo:
        q = q.filter(~Customer.name.startswith(DEMO_NAME_PREFIX))
    text = (query or "").strip()
    if text:
        like = f"%{text}%"
        norm = f"%{normalize_address(text)}%"
        q = q.filter(
            or_(
                Customer.name.ilike(like),
                Customer.normalized_address.ilike(norm),
                Customer.normalized_address.ilike(like),
            )
        )
    rows = q.order_by(Customer.name.asc(), Customer.id.asc()).limit(max(1, min(limit, 200))).all()
    out: list[dict] = []
    for c in rows:
        minutes, source = get_service_estimate(c)
        out.append(
            {
                "id": c.id,
                "name": c.name,
                "address": display_address(db, c),
                "lat": c.lat,
                "lng": c.lng,
                "category": c.category,
                "service_duration_min": minutes,
                "service_estimate_source": source,
                "service_sample_count": c.service_sample_count,
                "geocode_confidence": c.geocode_confidence,
            }
        )
    return out


def get_customers_by_ids(db: Session, ids: list[int]) -> list[Customer]:
    if not ids:
        return []
    rows = db.query(Customer).filter(Customer.id.in_(ids)).all()
    by_id = {c.id: c for c in rows}
    return [by_id[i] for i in ids if i in by_id]
