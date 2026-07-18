"""Isolated demo mode seed/purge — never mixes with real data."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from src.models.customer import Customer
from src.models.leg_sample import LegSample
from src.models.route import Route
from src.models.service_sample import ServiceSample
from src.models.stop import Stop
from src.models.user_settings import UserSettings
from src.models.work_day import WorkDay
from src.services.learning import recompute_customer_service_stats
from src.services.routes import today_local

JERUSALEM = ZoneInfo("Asia/Jerusalem")
DEMO_PREFIX = "[דמו] "

DEMO_STOPS = [
    ("בנק לאומי דיזנגוף", "דיזנגוף 50 תל אביב", 32.0765, 34.7745),
    ("סופרפארם אלנבי", "אלנבי 90 תל אביב", 32.0660, 34.7715),
    ("עזריאלי", "דרך בגין 132 תל אביב", 32.0743, 34.7922),
    ("רמת גן סינמה", "ז'בוטינסקי 122 רמת גן", 32.0840, 34.8020),
    ("בני ברק", "רבי עקיבא 100 בני ברק", 32.0855, 34.8320),
    ("פתח תקווה", "ז'בוטינסקי 54 פתח תקווה", 32.0910, 34.8860),
    ("חולון מרכז", "סוקולוב 40 חולון", 32.0160, 34.7790),
    ("בת ים", "החשמונאים 10 בת ים", 32.0155, 34.7450),
    ("הרצליה", "המשביר 1 הרצליה", 32.1630, 34.8080),
    ("רעננה", "אחוזה 100 רעננה", 32.1840, 34.8700),
    ("כפר סבא", "ויצמן 80 כפר סבא", 32.1750, 34.9070),
    ("גבעתיים", "בורוכוב 15 גבעתיים", 32.0700, 34.8100),
    ("נמל ת״א", "נמל תל אביב", 32.0965, 34.7730),
    ("ראשון לציון", "רוטשילד 20 ראשון לציון", 31.9640, 34.8040),
    ("יהוד", "כצנלסון 12 יהוד", 32.0300, 34.8900),
    ("רמת השרון", "סוקולוב 60 רמת השרון", 32.1460, 34.8410),
    ("אור יהודה", "העצמאות 20 אור יהודה", 32.0290, 34.8560),
    ("קריית אונו", "הציונות 10 קריית אונו", 32.0630, 34.8550),
]


def _settings(db: Session, user_id: int) -> UserSettings:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.flush()
    return row


def purge_demo(db: Session, user_id: int) -> None:
    demo_routes = db.query(Route).filter(Route.user_id == user_id, Route.is_demo.is_(True)).all()
    route_ids = [r.id for r in demo_routes]
    if route_ids:
        stop_ids = [s.id for s in db.query(Stop).filter(Stop.route_id.in_(route_ids)).all()]
        if stop_ids:
            db.query(ServiceSample).filter(ServiceSample.stop_id.in_(stop_ids)).delete(
                synchronize_session=False
            )
        db.query(Stop).filter(Stop.route_id.in_(route_ids)).delete(synchronize_session=False)
        db.query(WorkDay).filter(WorkDay.route_id.in_(route_ids)).delete(synchronize_session=False)
        db.query(Route).filter(Route.id.in_(route_ids)).delete(synchronize_session=False)

    demo_customers = db.query(Customer).filter(Customer.name.startswith(DEMO_PREFIX)).all()
    cids = [c.id for c in demo_customers]
    if cids:
        db.query(ServiceSample).filter(ServiceSample.customer_id.in_(cids)).delete(
            synchronize_session=False
        )
        db.query(LegSample).filter(
            (LegSample.from_customer_id.in_(cids)) | (LegSample.to_customer_id.in_(cids))
        ).delete(synchronize_session=False)
        db.query(Customer).filter(Customer.id.in_(cids)).delete(synchronize_session=False)
    db.commit()


def enable_demo(db: Session, user_id: int) -> dict:
    purge_demo(db, user_id)
    settings = _settings(db, user_id)
    settings.demo_mode = True

    customers: list[Customer] = []
    for name, addr, lat, lng in DEMO_STOPS:
        c = Customer(
            name=DEMO_PREFIX + name,
            normalized_address="demo:" + addr,
            lat=lat,
            lng=lng,
            category="retail_chain",
            default_service_min=12,
            parking_fixes=[
                {"lat": lat + 0.0001, "lng": lng},
                {"lat": lat, "lng": lng + 0.0001},
                {"lat": lat, "lng": lng},
            ],
            parking_sample_count=3,
            parking_lat=lat,
            parking_lng=lng,
            geocode_confidence=0.95,
        )
        db.add(c)
        customers.append(c)
    db.flush()

    today = today_local()
    first_stops: list[Stop] = []

    for day_off in range(5, -1, -1):
        d = today - timedelta(days=day_off)
        route = Route(
            user_id=user_id,
            date=d,
            status="completed" if day_off > 0 else "optimized",
            departure_time=time(7, 0),
            break_duration_min=30,
            break_window_start=time(11, 30),
            break_window_end=time(14, 0),
            is_demo=True,
            naive_duration_min=420,
            optimized_duration_min=360,
            optimized_at=datetime.combine(d, time(6, 50), tzinfo=JERUSALEM),
        )
        db.add(route)
        db.flush()
        stop_rows: list[Stop] = []
        for i, c in enumerate(customers):
            st = Stop(
                route_id=route.id,
                customer_id=c.id,
                customer_name=c.name,
                address=addr_for(c),
                lat=c.lat,
                lng=c.lng,
                sequence_order=i,
                service_duration_min=12,
                service_estimate_source="learned" if i < 6 else "category",
                status="done" if day_off > 0 else "pending",
                eta=datetime.combine(d, time(8 + i // 3, (i * 7) % 60), tzinfo=JERUSALEM),
            )
            if day_off > 0:
                st.actual_arrival = st.eta
                st.actual_departure = st.eta + timedelta(minutes=12)
            db.add(st)
            stop_rows.append(st)
        db.flush()
        if day_off == 5:
            first_stops = stop_rows

        start = datetime.combine(d, time(7, 5), tzinfo=JERUSALEM)
        end = start + timedelta(hours=8, minutes=20)
        db.add(
            WorkDay(
                user_id=user_id,
                date=d,
                route_id=route.id,
                start_at=start,
                end_at=end if day_off > 0 else None,
                break_min=30,
                driving_min=180,
                service_min=200,
                waiting_min=60,
                total_min=500 if day_off > 0 else None,
                overtime_min=0,
            )
        )

        if day_off in (5, 4, 3):
            for i in range(min(5, len(customers) - 1)):
                db.add(
                    LegSample(
                        from_lat=customers[i].lat,
                        from_lng=customers[i].lng,
                        to_lat=customers[i + 1].lat,
                        to_lng=customers[i + 1].lng,
                        from_customer_id=customers[i].id,
                        to_customer_id=customers[i + 1].id,
                        hour_bucket=8 + i,
                        day_bucket="weekday",
                        predicted_min=12.0,
                        actual_min=14.0,
                    )
                )

    # 3 samples each for first 6 customers (attach to first history stops)
    for i, c in enumerate(customers[:6]):
        for k in range(3):
            db.add(
                ServiceSample(
                    customer_id=c.id,
                    stop_id=first_stops[i].id,
                    duration_min=float(10 + (i % 5) + k),
                    day_bucket="weekday",
                    hour_bucket=9 + k,
                    exception_code="none",
                    is_outlier=False,
                )
            )
        db.flush()
        recompute_customer_service_stats(db, c)

    db.commit()
    return {"ok": True, "demo_mode": True, "customers": len(customers)}


def addr_for(c: Customer) -> str:
    return c.normalized_address.replace("demo:", "", 1)


def disable_demo(db: Session, user_id: int) -> dict:
    purge_demo(db, user_id)
    settings = _settings(db, user_id)
    settings.demo_mode = False
    db.commit()
    return {"ok": True, "demo_mode": False}
