"""Customer registry: normalize, find-or-create, service estimates."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from src.models.customer import Customer

CATEGORY_DEFAULTS: dict[str, int] = {
    "bank_branch": 15,
    "atm": 8,
    "retail_chain": 12,
    "private_business": 10,
    "other": 10,
}

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
        if geocode_confidence is not None:
            existing.geocode_confidence = geocode_confidence
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
