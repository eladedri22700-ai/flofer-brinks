"""Route and stop business logic for planning (no optimization)."""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from src.core.exceptions import AppError
from src.models.customer import Customer
from src.models.route import Route
from src.models.stop import Stop
from src.schemas.routes import RouteCreate, StopCreate, StopOut, StopUpdate
from src.services.customers import (
    display_address,
    find_or_create_customer,
    get_customers_by_ids,
    get_service_estimate,
)
from src.services import maps
from src.services.optimizer import MAX_STOPS

JERUSALEM = ZoneInfo("Asia/Jerusalem")


def today_local() -> date:
    return datetime.now(JERUSALEM).date()


def _learned_badge(customer: Customer | None, source: str, minutes: int) -> str | None:
    if customer is None:
        return f"{minutes} דק' · ברירת מחדל"
    if source == "learned" and customer.service_sample_count:
        return f"⏱ {minutes} דק' · נלמד · {customer.service_sample_count} ביקורים"
    return f"{minutes} דק' · ברירת מחדל"


def stop_to_out(stop: Stop, customer: Customer | None = None) -> StopOut:
    cust = customer if customer is not None else stop.customer
    badge = _learned_badge(cust, stop.service_estimate_source, stop.service_duration_min)
    conf = None
    park_lat = park_lng = None
    parking_badge = None
    if cust is not None:
        conf = cust.geocode_confidence
        park_lat = cust.parking_lat
        park_lng = cust.parking_lng
        if cust.learned_service_min is not None and cust.service_sample_count >= 3:
            badge = (
                f"⏱ {int(round(cust.learned_service_min))} דק' · נלמד · "
                f"{cust.service_sample_count} ביקורים"
            )
        if cust.parking_sample_count >= 3 and cust.parking_lat is not None:
            parking_badge = (
                f"📍 נקודת עצירה מדויקת ({cust.parking_sample_count} ביקורים)"
            )
    data = StopOut.model_validate(stop)
    return data.model_copy(
        update={
            "geocode_confidence": conf,
            "learned_badge": badge,
            "parking_badge": parking_badge,
            "parking_lat": park_lat,
            "parking_lng": park_lng,
        }
    )


def _route_priority(route: Route) -> tuple[int, int, int]:
    """Higher tuple wins: live work > ready order > planning with stops > empty > done."""
    status_rank = {
        "in_progress": 50,
        "optimized": 40,
        "manual": 40,
        "planning": 20,
        "completed": 10,
    }.get(route.status or "", 0)
    stop_n = len(route.stops or [])
    return (status_rank, stop_n, route.id)


def get_today_route(db: Session, user_id: int) -> Route | None:
    rows = (
        db.query(Route)
        .options(joinedload(Route.stops).joinedload(Stop.customer))
        .filter(Route.user_id == user_id, Route.date == today_local())
        .all()
    )
    if not rows:
        return None
    return max(rows, key=_route_priority)


def create_route(db: Session, user_id: int, body: RouteCreate) -> Route:
    existing = get_today_route(db, user_id)
    # Never spawn a second "today" route over a live / ready round.
    if existing and existing.status != "completed":
        return existing
    route = Route(
        user_id=user_id,
        date=today_local(),
        status="planning",
        departure_time=body.departure_time,
        break_duration_min=body.break_duration_min,
        break_window_start=body.break_window_start,
        break_window_end=body.break_window_end,
        deadline_buffer_min=body.deadline_buffer_min,
        vip_weight=body.vip_weight,
        variance_mode=body.variance_mode,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return get_today_route(db, user_id) or route


def get_route_for_user(db: Session, route_id: int, user_id: int) -> Route:
    route = (
        db.query(Route)
        .options(joinedload(Route.stops).joinedload(Stop.customer))
        .filter(Route.id == route_id, Route.user_id == user_id)
        .first()
    )
    if route is None:
        raise AppError(code="route_not_found", message_he="הסבב לא נמצא", status_code=404)
    return route


async def resolve_coords(body: StopCreate) -> tuple[float, float, str, float]:
    if body.place_id:
        details = await maps.place_details(body.place_id)
        return (
            details["lat"],
            details["lng"],
            details["formatted_address"] or body.address,
            float(details.get("confidence") or 0.7),
        )
    if body.lat is not None and body.lng is not None:
        conf = body.geocode_confidence if body.geocode_confidence is not None else 1.0
        return body.lat, body.lng, body.address, conf
    geo = await maps.geocode(body.address)
    return geo["lat"], geo["lng"], geo["formatted_address"], float(geo["confidence"])


def add_stops_from_customers(
    db: Session, route: Route, customer_ids: list[int]
) -> list[Stop]:
    """Compose today's round from saved customers (no re-geocode)."""
    customers = get_customers_by_ids(db, customer_ids)
    if not customers:
        raise AppError(
            code="customers_not_found",
            message_he="לא נמצאו לקוחות ברשימה השמורה.",
            status_code=404,
        )

    existing_ids = {
        s.customer_id for s in (route.stops or []) if s.customer_id is not None
    }
    next_order = 0
    if route.stops:
        next_order = max(s.sequence_order for s in route.stops) + 1

    created: list[Stop] = []
    for customer in customers:
        if customer.id in existing_ids:
            continue
        current = len(route.stops or []) + len(created)
        if current >= MAX_STOPS:
            raise AppError(
                code="too_many_stops",
                message_he=(
                    f"הגעתם למקסימום {MAX_STOPS} יעדים בסבב. "
                    "פצלו לרשימה נוספת או הסירו יעדים."
                ),
                status_code=400,
            )
        minutes, source = get_service_estimate(customer)
        address = display_address(db, customer)
        stop = Stop(
            route_id=route.id,
            customer_id=customer.id,
            customer_name=customer.name,
            address=address,
            lat=customer.lat,
            lng=customer.lng,
            sequence_order=next_order,
            priority="normal",
            tw_type="none",
            service_duration_min=minutes,
            service_estimate_source=source,
            status="pending",
        )
        db.add(stop)
        created.append(stop)
        existing_ids.add(customer.id)
        next_order += 1

    if not created:
        raise AppError(
            code="already_on_route",
            message_he="כל הלקוחות שנבחרו כבר נמצאים בסבב של היום.",
            status_code=400,
        )

    db.commit()
    for stop in created:
        db.refresh(stop)
        stop.customer = next(
            (c for c in customers if c.id == stop.customer_id), None
        )
    return created


async def add_stop(db: Session, route: Route, body: StopCreate) -> Stop:
    current = len(route.stops or [])
    if current >= MAX_STOPS:
        raise AppError(
            code="too_many_stops",
            message_he=(
                f"הגעתם למקסימום {MAX_STOPS} יעדים בסבב. "
                "פצלו לרשימה נוספת או הסירו יעדים."
            ),
            status_code=400,
        )
    lat, lng, address, confidence = await resolve_coords(body)
    customer = find_or_create_customer(
        db,
        name=body.customer_name,
        address=address,
        lat=lat,
        lng=lng,
        category=body.category,
        geocode_confidence=confidence,
    )
    minutes, source = get_service_estimate(customer)
    if body.service_duration_min is not None:
        minutes = body.service_duration_min
        source = "default"

    next_order = 0
    if route.stops:
        next_order = max(s.sequence_order for s in route.stops) + 1

    stop = Stop(
        route_id=route.id,
        customer_id=customer.id,
        customer_name=body.customer_name.strip(),
        address=address,
        lat=lat,
        lng=lng,
        sequence_order=next_order,
        priority=body.priority if body.priority in ("normal", "vip") else "normal",
        tw_type=body.tw_type if body.tw_type in ("none", "before", "after", "window") else "none",
        tw_start=body.tw_start,
        tw_end=body.tw_end,
        service_duration_min=minutes,
        service_estimate_source=source,
        notes=body.notes,
        status="pending",
    )
    db.add(stop)
    db.commit()
    db.refresh(stop)
    stop.customer = customer
    return stop


def update_stop(db: Session, stop: Stop, body: StopUpdate) -> Stop:
    data = body.model_dump(exclude_unset=True)
    confidence = data.pop("geocode_confidence", None)
    for key, value in data.items():
        setattr(stop, key, value)
    if stop.customer_id and (
        "lat" in data or "lng" in data or confidence is not None
    ):
        customer = db.query(Customer).filter(Customer.id == stop.customer_id).first()
        if customer is not None:
            if "lat" in data and data["lat"] is not None:
                customer.lat = data["lat"]
                customer.parking_lat = data["lat"]
            if "lng" in data and data["lng"] is not None:
                customer.lng = data["lng"]
                customer.parking_lng = data["lng"]
            if confidence is not None:
                customer.geocode_confidence = confidence
    db.commit()
    db.refresh(stop)
    return stop


def delete_stop(db: Session, stop: Stop) -> None:
    route_id = stop.route_id
    db.delete(stop)
    db.flush()
    remaining = (
        db.query(Stop)
        .filter(Stop.route_id == route_id)
        .order_by(Stop.sequence_order)
        .all()
    )
    for i, s in enumerate(remaining):
        s.sequence_order = i
    db.commit()


def reorder_stops(db: Session, route: Route, stop_ids: list[int]) -> list[Stop]:
    by_id = {s.id: s for s in route.stops}
    if set(stop_ids) != set(by_id.keys()):
        raise AppError(
            code="reorder_mismatch",
            message_he="רשימת היעדים לסידור מחדש אינה תואמת.",
            status_code=400,
        )
    for i, sid in enumerate(stop_ids):
        by_id[sid].sequence_order = i
    db.commit()
    return sorted(route.stops, key=lambda s: s.sequence_order)
