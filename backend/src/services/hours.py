"""Work hours dashboard aggregates — tracking/display, not payroll."""

from __future__ import annotations

import csv
import io
from calendar import monthrange
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from src.core.exceptions import AppError
from src.models.route import Route
from src.models.route_event import RouteEvent
from src.models.stop import Stop
from src.models.user_settings import UserSettings
from src.models.work_day import WorkDay

JERUSALEM = ZoneInfo("Asia/Jerusalem")


def _settings(db: Session, user_id: int) -> UserSettings:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _fmt_hm(minutes: int | None) -> str:
    m = max(0, minutes or 0)
    return f"{m // 60}:{m % 60:02d}"


def dashboard(db: Session, user_id: int) -> dict:
    settings = _settings(db, user_id)
    today = datetime.now(JERUSALEM).date()
    week_start = today - timedelta(days=today.weekday())  # Mon
    month_start = today.replace(day=1)

    days = db.query(WorkDay).filter(WorkDay.user_id == user_id).all()
    today_wd = next((d for d in days if d.date == today), None)

    def sum_total(filt) -> int:
        return sum((d.total_min or 0) for d in days if filt(d))

    week_min = sum_total(lambda d: d.date >= week_start)
    month_min = sum_total(lambda d: d.date >= month_start)
    month_ot = sum((d.overtime_min or 0) for d in days if d.date >= month_start)
    cum_min = sum((d.total_min or 0) for d in days)
    work_days_n = sum(1 for d in days if d.total_min)
    avg_daily = int(cum_min / work_days_n) if work_days_n else 0

    last_month_end = month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    last_month_days = [d for d in days if last_month_start <= d.date <= last_month_end]
    last_avg = 0
    if last_month_days:
        lm = sum(d.total_min or 0 for d in last_month_days)
        last_avg = int(lm / len(last_month_days))

    # Day composition from today work_day + stops
    driving = today_wd.driving_min if today_wd else 0
    service = today_wd.service_min if today_wd else 0
    waiting = today_wd.waiting_min if today_wd else 0
    break_m = today_wd.break_min if today_wd else 0
    if today_wd and today_wd.route_id:
        stops = db.query(Stop).filter(Stop.route_id == today_wd.route_id).all()
        if not service:
            for s in stops:
                if s.actual_arrival and s.actual_departure:
                    service += int(
                        (s.actual_departure - s.actual_arrival).total_seconds() / 60
                    )
        if today_wd.total_min and not driving:
            driving = max(0, today_wd.total_min - service - waiting - break_m)

    total_comp = driving + service + waiting + break_m
    wait_pct = int(round(100 * waiting / total_comp)) if total_comp else 0

    return {
        "today_start_at": today_wd.start_at.isoformat() if today_wd and today_wd.start_at else None,
        "today_end_at": today_wd.end_at.isoformat() if today_wd and today_wd.end_at else None,
        "today_elapsed_min": (
            int((datetime.now(JERUSALEM) - today_wd.start_at).total_seconds() / 60)
            if today_wd and today_wd.start_at and not today_wd.end_at
            else (today_wd.total_min if today_wd else 0)
        ),
        "week_min": week_min,
        "week_standard_min": settings.standard_week_min,
        "month_min": month_min,
        "month_overtime_min": month_ot,
        "cumulative_min": cum_min,
        "work_days_count": work_days_n,
        "daily_avg_min": avg_daily,
        "daily_avg_trend_min": avg_daily - last_avg,
        "composition": {
            "driving_min": driving,
            "service_min": service,
            "waiting_min": waiting,
            "break_min": break_m,
            "waiting_pct": wait_pct,
            "insight_he": f"{wait_pct}% מהיום המתנה" if total_comp else "אין נתונים להיום",
        },
        "standard_day_min": settings.standard_day_min,
        "disclaimer_he": "כלי מעקב ותצוגה — לא מערכת שכר רשמית.",
    }


def list_days(db: Session, user_id: int, month: str) -> list[dict]:
    try:
        y, m = map(int, month.split("-"))
        start = date(y, m, 1)
        end = date(y, m, monthrange(y, m)[1])
    except Exception as exc:
        raise AppError(code="bad_month", message_he="חודש לא תקין (YYYY-MM)", status_code=400) from exc

    rows = (
        db.query(WorkDay)
        .filter(WorkDay.user_id == user_id, WorkDay.date >= start, WorkDay.date <= end)
        .order_by(WorkDay.date.desc())
        .all()
    )
    out = []
    for d in rows:
        stops_done = 0
        if d.route_id:
            stops_done = (
                db.query(Stop)
                .filter(Stop.route_id == d.route_id, Stop.status.in_(["done", "skipped"]))
                .count()
            )
        out.append(
            {
                "id": d.id,
                "date": d.date.isoformat(),
                "start_at": d.start_at.isoformat() if d.start_at else None,
                "end_at": d.end_at.isoformat() if d.end_at else None,
                "break_min": d.break_min,
                "total_min": d.total_min,
                "overtime_min": d.overtime_min,
                "stops_done": stops_done,
                "manually_edited": d.manually_edited,
                "edit_note": d.edit_note,
            }
        )
    return out


def patch_day(
    db: Session,
    user_id: int,
    day_id: int,
    *,
    start_at: datetime | None,
    end_at: datetime | None,
    note: str | None,
) -> dict:
    wd = db.query(WorkDay).filter(WorkDay.id == day_id, WorkDay.user_id == user_id).first()
    if wd is None:
        raise AppError(code="not_found", message_he="יום עבודה לא נמצא", status_code=404)
    if start_at is not None:
        wd.start_at = start_at
    if end_at is not None:
        wd.end_at = end_at
    wd.manually_edited = True
    if note:
        wd.edit_note = note
    if wd.start_at and wd.end_at:
        wd.total_min = max(
            0, int((wd.end_at - wd.start_at).total_seconds() / 60) - (wd.break_min or 0)
        )
        settings = _settings(db, user_id)
        wd.overtime_min = max(0, (wd.total_min or 0) - settings.standard_day_min)
    if wd.route_id:
        db.add(
            RouteEvent(
                route_id=wd.route_id,
                type="work_day_edited",
                payload={"work_day_id": wd.id, "note": note},
            )
        )
    db.commit()
    return list_days(db, user_id, wd.date.strftime("%Y-%m"))[0]


def export_month(db: Session, user_id: int, month: str, fmt: str) -> tuple[bytes, str, str]:
    rows = list_days(db, user_id, month)
    if fmt == "pdf":
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont("Helvetica", 14)
        c.drawString(40, 800, f"RouteMaster hours {month}")
        c.setFont("Helvetica", 9)
        y = 770
        c.drawString(40, y, "date | out | in | break | total | OT | stops | edited")
        y -= 16
        for r in rows:
            line = (
                f"{r['date']} | {r['start_at'] or '-'} | {r['end_at'] or '-'} | "
                f"{r['break_min']} | {_fmt_hm(r['total_min'])} | {r['overtime_min']} | "
                f"{r['stops_done']} | {'Y' if r['manually_edited'] else 'N'}"
            )
            c.drawString(40, y, line[:110])
            y -= 14
            if y < 40:
                c.showPage()
                y = 800
        c.drawString(40, max(40, y - 20), "Tracking tool only — not payroll.")
        c.save()
        return buf.getvalue(), "application/pdf", f"hours-{month}.pdf"

    # CSV
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        ["date", "start_at", "end_at", "break_min", "total_min", "overtime_min", "stops_done", "manually_edited", "note"]
    )
    for r in rows:
        w.writerow(
            [
                r["date"],
                r["start_at"],
                r["end_at"],
                r["break_min"],
                r["total_min"],
                r["overtime_min"],
                r["stops_done"],
                r["manually_edited"],
                r["edit_note"] or "",
            ]
        )
    data = buf.getvalue().encode("utf-8-sig")
    return data, "text/csv", f"hours-{month}.csv"
