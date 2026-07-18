"""Route history, duplicate, daily summary, accuracy analytics."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from src.core.exceptions import AppError
from src.models.customer import Customer
from src.models.route import Route
from src.models.service_sample import ServiceSample
from src.models.stop import Stop
from src.models.work_day import WorkDay
from src.services.routes import today_local

JERUSALEM = ZoneInfo("Asia/Jerusalem")


def list_history(db: Session, user_id: int, limit: int = 60) -> list[dict]:
    routes = (
        db.query(Route)
        .options(joinedload(Route.stops))
        .filter(Route.user_id == user_id)
        .order_by(Route.date.desc(), Route.id.desc())
        .limit(limit)
        .all()
    )
    out = []
    for r in routes:
        done = sum(1 for s in (r.stops or []) if s.status in ("done", "skipped"))
        out.append(
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "status": r.status,
                "is_demo": r.is_demo,
                "stops_total": len(r.stops or []),
                "stops_done": done,
                "naive_duration_min": r.naive_duration_min,
                "optimized_duration_min": r.optimized_duration_min,
                "savings_min": (
                    max(0, (r.naive_duration_min or 0) - (r.optimized_duration_min or 0))
                    if r.naive_duration_min and r.optimized_duration_min
                    else None
                ),
            }
        )
    return out


def duplicate_route(db: Session, route: Route, user_id: int) -> Route:
    if route.user_id != user_id:
        raise AppError(code="forbidden", message_he="אין הרשאה", status_code=403)
    target_date = today_local()
    # If today already has a planning route, use tomorrow
    existing = (
        db.query(Route)
        .filter(Route.user_id == user_id, Route.date == target_date, Route.status == "planning")
        .first()
    )
    if existing and existing.stops:
        target_date = target_date + timedelta(days=1)

    new_r = Route(
        user_id=user_id,
        date=target_date,
        status="planning",
        departure_time=route.departure_time,
        break_duration_min=route.break_duration_min,
        break_window_start=route.break_window_start,
        break_window_end=route.break_window_end,
        deadline_buffer_min=route.deadline_buffer_min,
        vip_weight=route.vip_weight,
        variance_mode=route.variance_mode,
        is_demo=route.is_demo,
    )
    db.add(new_r)
    db.flush()
    for s in sorted(route.stops or [], key=lambda x: x.sequence_order):
        db.add(
            Stop(
                route_id=new_r.id,
                customer_id=s.customer_id,
                customer_name=s.customer_name,
                address=s.address,
                lat=s.lat,
                lng=s.lng,
                sequence_order=s.sequence_order,
                priority=s.priority,
                tw_type=s.tw_type,
                tw_start=s.tw_start,
                tw_end=s.tw_end,
                service_duration_min=s.service_duration_min,
                service_estimate_source=s.service_estimate_source,
                notes=s.notes,
                status="pending",
            )
        )
    db.commit()
    return (
        db.query(Route)
        .options(joinedload(Route.stops).joinedload(Stop.customer))
        .filter(Route.id == new_r.id)
        .first()
    )


def _day_blessing(
    *,
    done_n: int,
    total_n: int,
    exceptions_n: int,
    overtime_min: int | None,
) -> str:
    if total_n > 0 and done_n + 0 >= total_n and exceptions_n == 0:
        return "יום מושלם — כל היעדים בוצעו בלי חריגות. כל הכבוד!"
    if overtime_min and overtime_min >= 30:
        return "סיימתם יום ארוך ומאתגר — תודה על המאמץ. לנוח קצת, מגיע לכם."
    if done_n >= max(1, total_n - 1):
        return "כל הכבוד! יום העבודה הסתיים בהצלחה. נסיעה בטוחה הביתה."
    return "יום העבודה נסגר. תודה על העבודה היום — נתראה מחר."


def route_summary(db: Session, route: Route) -> dict:
    stops = sorted(route.stops or [], key=lambda s: s.sequence_order)
    done = [s for s in stops if s.status == "done"]
    skipped = [s for s in stops if s.status == "skipped"]
    exceptions = [
        {"name": s.customer_name, "code": s.exception_code, "note": s.exception_note}
        for s in done
        if s.exception_code and s.exception_code != "none"
    ]
    savings = 0
    if route.naive_duration_min and route.optimized_duration_min:
        savings = max(0, route.naive_duration_min - route.optimized_duration_min)

    # Top time-wasting customers this month (by avg service sample)
    month_start = datetime.now(JERUSALEM).date().replace(day=1)
    samples = (
        db.query(ServiceSample)
        .filter(ServiceSample.recorded_at >= datetime.combine(month_start, time.min, tzinfo=JERUSALEM))
        .all()
    )
    by_c: dict[int, list[float]] = {}
    for sm in samples:
        by_c.setdefault(sm.customer_id, []).append(sm.duration_min)
    top = []
    for cid, vals in by_c.items():
        cust = db.query(Customer).filter(Customer.id == cid).first()
        if cust:
            top.append({"name": cust.name, "avg_min": round(median(vals), 1)})
    top.sort(key=lambda x: -x["avg_min"])

    planned_end = None
    if route.optimized_duration_min is not None:
        dep = route.departure_time
        base = datetime.combine(route.date, dep, tzinfo=JERUSALEM)
        planned_end = (base + timedelta(minutes=route.optimized_duration_min)).isoformat()

    actual_end = None
    lasts = [s.actual_departure for s in done if s.actual_departure]
    if lasts:
        actual_end = max(lasts).isoformat()

    wd = (
        db.query(WorkDay)
        .filter(WorkDay.route_id == route.id)
        .first()
    )
    total_min = wd.total_min if wd else None
    overtime_min = wd.overtime_min if wd else None

    stop_ids = [s.id for s in stops]
    samples_today = 0
    if stop_ids:
        samples_today = (
            db.query(ServiceSample)
            .filter(
                ServiceSample.stop_id.in_(stop_ids),
                ServiceSample.is_outlier.is_(False),
            )
            .count()
        )

    blessing = _day_blessing(
        done_n=len(done),
        total_n=len(stops),
        exceptions_n=len(exceptions),
        overtime_min=overtime_min,
    )
    learning_he = (
        f"נשמרו {samples_today} מדידות שירות — ההערכות לסבבים הבאים ישתפרו."
        if samples_today
        else "ככל שתסעו עם GPS פתוח, המערכת תלמד זמני שירות ונסיעה ותדייק את ההערכות."
    )

    return {
        "route_id": route.id,
        "date": route.date.isoformat(),
        "stops_done": len(done),
        "stops_skipped": len(skipped),
        "stops_total": len(stops),
        "savings_min": savings,
        "savings_he": f"חסכת היום {savings} דקות" if savings else "אין חיסכון מדיד מול הסדר הנאיבי",
        "planned_finish": planned_end,
        "actual_finish": actual_end,
        "exceptions": exceptions,
        "top_slow_customers": top[:5],
        "message_he": "הסבב הושלם",
        "blessing_he": blessing,
        "learning_he": learning_he,
        "samples_today": samples_today,
        "work_total_min": total_min,
        "overtime_min": overtime_min,
    }


def accuracy_report(db: Session, user_id: int) -> dict:
    """Median ETA error (actual - planned) by week — proves learning."""
    routes = (
        db.query(Route)
        .options(joinedload(Route.stops))
        .filter(Route.user_id == user_id, Route.is_demo.is_(False))
        .order_by(Route.date.asc())
        .all()
    )
    by_week: dict[str, list[float]] = {}
    for r in routes:
        week = r.date.isocalendar()
        key = f"{week.year}-W{week.week:02d}"
        for s in r.stops or []:
            if s.eta and s.actual_arrival:
                err = abs((s.actual_arrival - s.eta).total_seconds() / 60)
                by_week.setdefault(key, []).append(err)

    series = []
    for key in sorted(by_week.keys()):
        vals = by_week[key]
        series.append({"week": key, "median_error_min": round(median(vals), 1), "n": len(vals)})

    improvement_he = None
    if len(series) >= 2 and series[0]["median_error_min"] > 0:
        first, last = series[0]["median_error_min"], series[-1]["median_error_min"]
        pct = int(round(100 * (first - last) / first))
        if pct > 0:
            improvement_he = f"דיוק החיזוי השתפר ב-{pct}% מאז תחילת השימוש"

    return {"weeks": series, "improvement_he": improvement_he}


def plan_vs_actual(db: Session, route: Route) -> dict:
    """Per-stop planned ETA vs actual arrival/departure for history UI."""
    stops = sorted(route.stops or [], key=lambda s: s.sequence_order)
    rows = []
    errors: list[float] = []
    for s in stops:
        eta_err = None
        if s.eta and s.actual_arrival:
            eta_err = round((s.actual_arrival - s.eta).total_seconds() / 60, 1)
            errors.append(abs(eta_err))
        rows.append(
            {
                "id": s.id,
                "sequence_order": s.sequence_order,
                "customer_name": s.customer_name,
                "status": s.status,
                "eta": s.eta.isoformat() if s.eta else None,
                "actual_arrival": s.actual_arrival.isoformat() if s.actual_arrival else None,
                "actual_departure": (
                    s.actual_departure.isoformat() if s.actual_departure else None
                ),
                "eta_error_min": eta_err,
                "exception_code": s.exception_code,
            }
        )
    return {
        "route_id": route.id,
        "date": route.date.isoformat(),
        "status": route.status,
        "optimized_duration_min": route.optimized_duration_min,
        "naive_duration_min": route.naive_duration_min,
        "median_abs_error_min": round(median(errors), 1) if errors else None,
        "stops": rows,
    }
