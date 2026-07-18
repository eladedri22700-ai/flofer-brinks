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
    clean_name = (name or "").strip() or "לקוח"
    existing = (
        db.query(Customer)
        .filter(
            Customer.normalized_address == normalized,
            Customer.name == clean_name,
        )
        .first()
    )
    # Same place, different OCR name → reuse address match
    if existing is None:
        existing = (
            db.query(Customer)
            .filter(Customer.normalized_address == normalized)
            .order_by(Customer.id.asc())
            .first()
        )
    if existing:
        existing.lat = lat
        existing.lng = lng
        if geocode_confidence is not None:
            existing.geocode_confidence = geocode_confidence
        if category in CATEGORY_DEFAULTS:
            existing.category = category
        # Prefer a more descriptive name when OCR improves
        if clean_name and clean_name != "לקוח" and (
            not existing.name or existing.name == "לקוח" or len(clean_name) > len(existing.name)
        ):
            existing.name = clean_name
        return existing

    customer = Customer(
        name=clean_name,
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


async def remember_drafts(db: Session, drafts: list[dict]) -> tuple[int, list[int]]:
    """Persist uploaded/extracted addresses into the customer library for next rounds."""
    from src.services import maps

    ids: list[int] = []
    for raw in drafts:
        name = str(raw.get("customer_name") or "לקוח").strip() or "לקוח"
        address = str(raw.get("address") or "").strip()
        if len(address) < 2:
            continue
        lat = raw.get("lat")
        lng = raw.get("lng")
        conf = raw.get("geocode_confidence")
        category = str(raw.get("category") or "other")
        try:
            if lat is None or lng is None:
                geo = await maps.geocode(address)
                lat = float(geo["lat"])
                lng = float(geo["lng"])
                address = str(geo.get("formatted_address") or address)
                conf = float(geo.get("confidence") or 0.6)
            else:
                lat = float(lat)
                lng = float(lng)
            customer = find_or_create_customer(
                db,
                name=name,
                address=address,
                lat=lat,
                lng=lng,
                category=category,
                geocode_confidence=float(conf) if conf is not None else None,
            )
            # Keep a readable address for library display (via a zero-route note is overkill);
            # store original in notes if empty
            if not customer.notes:
                customer.notes = address
            ids.append(customer.id)
        except Exception:
            continue
    db.commit()
    # unique preserve order
    seen: set[int] = set()
    unique_ids: list[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            unique_ids.append(i)
    return len(unique_ids), unique_ids


async def create_customer_manual(
    db: Session,
    *,
    name: str,
    address: str,
    lat: float | None = None,
    lng: float | None = None,
    place_id: str | None = None,
    category: str = "other",
    geocode_confidence: float | None = None,
) -> Customer:
    from src.services import maps

    resolved_address = address.strip()
    resolved_lat = lat
    resolved_lng = lng
    conf = geocode_confidence
    if place_id:
        details = await maps.place_details(place_id)
        resolved_lat = float(details["lat"])
        resolved_lng = float(details["lng"])
        resolved_address = str(details.get("formatted_address") or resolved_address)
        conf = float(details.get("confidence") or 0.8)
    elif resolved_lat is None or resolved_lng is None:
        geo = await maps.geocode(resolved_address)
        resolved_lat = float(geo["lat"])
        resolved_lng = float(geo["lng"])
        resolved_address = str(geo.get("formatted_address") or resolved_address)
        conf = float(geo.get("confidence") or 0.7)

    customer = find_or_create_customer(
        db,
        name=name,
        address=resolved_address,
        lat=float(resolved_lat),
        lng=float(resolved_lng),
        category=category,
        geocode_confidence=conf,
    )
    customer.notes = resolved_address
    db.commit()
    db.refresh(customer)
    return customer


def display_address(db: Session, customer: Customer) -> str:
    if customer.notes and customer.notes.strip():
        return customer.notes.strip()
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
