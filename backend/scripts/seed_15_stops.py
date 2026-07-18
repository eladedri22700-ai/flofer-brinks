"""Seed ~15 Gush Dan mock stops for route engine demos/tests."""

from __future__ import annotations

from datetime import time

from src.db.session import SessionLocal
from src.models.route import Route
from src.models.stop import Stop
from src.models.user import User
from src.services.routes import today_local

# Rough Tel Aviv / Gush Dan coordinates (mock)
GUSH_DAN_STOPS = [
    ("בנק לאומי דיזנגוף", "דיזנגוף 50 תל אביב", 32.0765, 34.7745, "before", None, time(10, 0)),
    ("סופרפארם אלנבי", "אלנבי 90 תל אביב", 32.0660, 34.7715, "none", None, None),
    ("קניון עזריאלי", "דרך מנחם בגין 132 תל אביב", 32.0743, 34.7922, "window", time(9, 0), time(12, 0)),
    ("רמת גן סינמה סיטי", "ז'בוטינסקי 122 רמת גן", 32.0840, 34.8020, "none", None, None),
    ("בני ברק רבי עקיבא", "רבי עקיבא 100 בני ברק", 32.0855, 34.8320, "after", time(10, 30), None),
    ("פתח תקווה קניון גדול", "ז'בוטינסקי 54 פתח תקווה", 32.0910, 34.8860, "none", None, None),
    ("חולון מרכז", "סוקולוב 40 חולון", 32.0160, 34.7790, "before", None, time(11, 30)),
    ("בת ים הטיילת", "החשמונאים 10 בת ים", 32.0155, 34.7450, "none", None, None),
    ("הרצליה פיתוח", "המשביר 1 הרצליה", 32.1630, 34.8080, "vip", None, None),
    ("רעננה מרכז", "אחוזה 100 רעננה", 32.1840, 34.8700, "none", None, None),
    ("כפר סבא ויצמן", "ויצמן 80 כפר סבא", 32.1750, 34.9070, "none", None, None),
    ("גבעתיים בורוכוב", "בורוכוב 15 גבעתיים", 32.0700, 34.8100, "none", None, None),
    ("תל אביב נמל", "נמל תל אביב", 32.0965, 34.7730, "none", None, None),
    ("ראשון לציון רוטשילד", "רוטשילד 20 ראשון לציון", 31.9640, 34.8040, "before", None, time(13, 0)),
    ("יהוד כצנלסון", "כצנלסון 12 יהוד", 32.0300, 34.8900, "none", None, None),
]


def seed_15_stops(username: str = "leader") -> int:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise SystemExit("User not found — run seed first")

        route = (
            db.query(Route)
            .filter(Route.user_id == user.id, Route.date == today_local())
            .order_by(Route.id.desc())
            .first()
        )
        if route is None:
            route = Route(
                user_id=user.id,
                date=today_local(),
                status="planning",
                departure_time=time(7, 0),
                break_duration_min=30,
                break_window_start=time(11, 30),
                break_window_end=time(14, 0),
            )
            db.add(route)
            db.flush()
        else:
            db.query(Stop).filter(Stop.route_id == route.id).delete()
            db.flush()

        for i, row in enumerate(GUSH_DAN_STOPS):
            name, address, lat, lng, kind, tw_s, tw_e = row
            priority = "vip" if kind == "vip" else "normal"
            tw_type = "none" if kind == "vip" else kind
            db.add(
                Stop(
                    route_id=route.id,
                    customer_name=name,
                    address=address,
                    lat=lat,
                    lng=lng,
                    sequence_order=i,
                    priority=priority,
                    tw_type=tw_type,
                    tw_start=tw_s,
                    tw_end=tw_e,
                    service_duration_min=12,
                    service_estimate_source="default",
                    status="pending",
                )
            )
        db.commit()
        print(f"Seeded {len(GUSH_DAN_STOPS)} stops on route_id={route.id}")
        return route.id
    finally:
        db.close()


if __name__ == "__main__":
    seed_15_stops()
