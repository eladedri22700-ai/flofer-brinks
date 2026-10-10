"""Server-side round watcher — keeps forecasting and alerting while the app is closed.

Every couple of minutes, for each round in progress:
1. re-forecast ETAs from the crew's last known position (live_reforecast),
2. push an alert (each one at most once) when:
   - the forecast return to the depot slips ≥15 min past the plan (and every 15 min more),
   - a stop with a deadline is now forecast to miss it,
   - the next stop's ETA passed 20+ min ago, nothing was marked and the app is silent.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from src.db.session import SessionLocal
from src.models.route import Route
from src.services import push
from src.services.forecast import live_reforecast

logger = logging.getLogger(__name__)
JERUSALEM = ZoneInfo("Asia/Jerusalem")
TICK_SECONDS = 120
SLIP_STEP_MIN = 15
STALE_AFTER_MIN = 20
APP_SILENT_MIN = 10


def _hm(dt: datetime) -> str:
    return dt.astimezone(JERUSALEM).strftime("%H:%M")


def _app_silent(route: Route, now: datetime) -> bool:
    return route.last_pos_at is None or now - route.last_pos_at.astimezone(JERUSALEM) > timedelta(
        minutes=APP_SILENT_MIN
    )


async def _alerts_for(db: Session, route: Route, now: datetime) -> None:
    uid = route.user_id
    expl = route.solver_explanation or {}
    ordered = sorted(route.stops or [], key=lambda s: s.sequence_order)
    nxt = next((s for s in ordered if s.status in ("pending", "arrived")), None)
    silent = _app_silent(route, now)

    # With the app closed there's no new position: how overdue the next stop is
    # (vs. the last real forecast) is the delay signal.
    overdue = timedelta(0)
    if silent and nxt is not None and nxt.status == "pending" and nxt.eta is not None:
        overdue = max(timedelta(0), now - nxt.eta.astimezone(JERUSALEM))

    ret_raw, planned_raw = expl.get("return_at"), expl.get("planned_return_at")
    if ret_raw and planned_raw:
        ret = datetime.fromisoformat(ret_raw) + overdue
        delta = int((ret - datetime.fromisoformat(planned_raw)).total_seconds() // 60)
        if delta >= SLIP_STEP_MIN:
            step = delta // SLIP_STEP_MIN
            if push.claim_once(db, uid, route.id, "return_slip", f"{route.id}:{step}"):
                await push.send_to_user(
                    db, uid,
                    title=f"צפי חזרה לברינקס: {_hm(ret)}",
                    body=f"+{delta} דק' מהתכנון. אפשר לבדוק סידור מחדש ביעדים שנותרו.",
                    url="/app/live", tag=f"return-{route.id}",
                )

    pending = [s for s in ordered if s.status == "pending"]

    for stop in pending:
        if stop.tw_type not in ("before", "window") or stop.tw_end is None or stop.eta is None:
            continue
        eta_local = stop.eta.astimezone(JERUSALEM)
        limit = datetime.combine(route.date, stop.tw_end, tzinfo=JERUSALEM) - timedelta(
            minutes=route.deadline_buffer_min
        )
        if eta_local > limit and push.claim_once(db, uid, route.id, "tw_risk", f"{stop.id}"):
            await push.send_to_user(
                db, uid,
                title=f"«{stop.customer_name}» בסיכון לחלון הזמן",
                body=f"צפי הגעה {_hm(stop.eta)}, חייבים עד {stop.tw_end.strftime('%H:%M')}. כדאי להקדים אותו בסדר.",
                url="/app/route", tag=f"tw-{stop.id}",
            )

    if (
        nxt is not None
        and nxt.status == "pending"
        and silent
        and overdue > timedelta(minutes=STALE_AFTER_MIN)
        and push.claim_once(db, uid, route.id, "stale_arrival", f"{nxt.id}")
    ):
        await push.send_to_user(
            db, uid,
            title=f"הגעתם ל«{nxt.customer_name}»?",
            body="לא סומנה הגעה. פתחו את האפליקציה לסימון — כל הזמנים והחזרה לברינקס יתעדכנו.",
            url="/app/live", tag=f"stale-{nxt.id}",
        )


async def tick() -> None:
    now = datetime.now(JERUSALEM)
    db = SessionLocal()
    try:
        routes = (
            db.query(Route)
            .options(joinedload(Route.stops))
            .filter(Route.status == "in_progress", Route.date >= date.today() - timedelta(days=1))
            .all()
        )
        for route in routes:
            try:
                # Only re-forecast on fresh information; a silent app is handled
                # as "overdue" in the alerts instead of sliding every ETA forward.
                if not _app_silent(route, now):
                    await live_reforecast(db, route)
                    db.refresh(route)
                await _alerts_for(db, route, now)
            except Exception:  # noqa: BLE001 — one bad round must not stop the others
                logger.exception("live watch failed for route %s", route.id)
                db.rollback()
    finally:
        db.close()


async def run_forever() -> None:
    await asyncio.sleep(20)  # let the app finish booting
    while True:
        try:
            await tick()
        except Exception:  # noqa: BLE001
            logger.exception("live watch tick failed")
        await asyncio.sleep(TICK_SECONDS)
