"""Field notes → immediate learning + a development queue.

A crew member writes a short note ("parking at Azrieli takes 15 min now",
"the map froze"). Claude reads it with the round's context and returns
structured actions; safe, bounded data actions are applied at once (service
time, notes on a customer), app problems and ideas go to GitHub Issues so
development can pick them up. Without an Anthropic key a small rule-based
reader handles the common case (minutes for the linked stop).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.models.customer import Customer
from src.models.feedback import Feedback
from src.models.route import Route
from src.models.stop import Stop
from src.models.user import User

logger = logging.getLogger(__name__)
JERUSALEM = ZoneInfo("Asia/Jerusalem")
MODEL = "claude-opus-5-5"
MAX_SERVICE_MIN = 120


class FieldAction(BaseModel):
    kind: Literal["service_time", "customer_note", "opens_at", "closes_at", "app_problem", "idea"]
    customer_id: int | None = Field(
        default=None, description="id from the candidate list the note is about, if any"
    )
    minutes: int | None = Field(default=None, description="service/wait minutes at the stop, for service_time")
    time_hm: str | None = Field(default=None, description="HH:MM 24h, for opens_at / closes_at")
    text_he: str = Field(description="short Hebrew text: the note to store, or the problem/idea")


class FeedbackAnalysis(BaseModel):
    category: Literal["field_data", "bug", "idea", "other"]
    summary_he: str = Field(description="one short Hebrew sentence")
    actions: list[FieldAction]


SYSTEM = """You read short notes written in Hebrew by a cash-logistics crew lead during a delivery round.
Turn each note into actions:
- service_time: the note states how long a stop takes now (parking, waiting, security, queue). Give minutes (total time at the stop) and the customer_id from the candidates.
- opens_at / closes_at: the place can only be served from / until a clock time today (give time_hm as HH:MM). Also add a customer_note with the same fact.
- customer_note: lasting practical info about a customer (entrance, parking spot, contact, opening hours). Keep text_he short.
- app_problem: something in the app is broken, wrong or confusing.
- idea: a request or suggestion for the app.
Only use customer_id values from the candidate list. If the note is unclear, return no data actions and category "other". Never invent minutes that are not in the note."""


_WORD = re.compile(r"[\w֐-׿'\"״׳-]{3,}")


def _library_matches(db: Session, text: str, limit: int = 12) -> list[Customer]:
    """Saved customers whose name shares a word with the note (e.g. «עזריאלי»)."""
    from sqlalchemy import or_

    words = {w.strip("'\"״׳-") for w in _WORD.findall(text)}
    # Hebrew attaches prepositions to words: «בעזריאלי» → also try «עזריאלי»
    words |= {w[1:] for w in words if len(w) > 4 and w[0] in "בלמהוכש"}
    words = {w for w in words if len(w) >= 3}
    if not words:
        return []
    return (
        db.query(Customer)
        .filter(~Customer.normalized_address.startswith("demo:"))
        .filter(or_(*[Customer.name.ilike(f"%{w}%") for w in list(words)[:12]]))
        .order_by(Customer.service_sample_count.desc())
        .limit(limit)
        .all()
    )


def _candidates(db: Session, route: Route | None, stop: Stop | None, text: str = "") -> list[dict]:
    rows: list[Stop] = []
    if stop is not None:
        rows.append(stop)
    if route is not None:
        rows += [s for s in sorted(route.stops or [], key=lambda s: s.sequence_order) if s is not stop]
    seen: set[int] = set()
    out = []
    for s in rows:
        if s.customer_id is None or s.customer_id in seen:
            continue
        seen.add(s.customer_id)
        out.append({"customer_id": s.customer_id, "name": s.customer_name, "address": s.address})
    for c in _library_matches(db, text):
        if c.id not in seen:
            seen.add(c.id)
            out.append({"customer_id": c.id, "name": c.name, "address": c.notes or c.normalized_address})
    return out[:50]


async def _analyze_with_claude(text: str, candidates: list[dict], linked: dict | None) -> FeedbackAnalysis | None:
    key = get_settings().anthropic_api_key.strip()
    if not key:
        return None
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=key)
    context = "Candidates (customer_id, name, address):\n" + "\n".join(
        f"- {c['customer_id']}: {c['name']} — {c['address']}" for c in candidates
    )
    if linked:
        context += f"\nThe note was written on the stop of customer_id {linked['customer_id']} ({linked['name']})."
    try:
        response = await client.messages.parse(
            model=MODEL,
            max_tokens=4000,
            system=SYSTEM,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": f"{context}\n\nNote:\n{text}"}],
            output_format=FeedbackAnalysis,
        )
    except anthropic.APIError:
        logger.exception("Feedback analysis failed")
        return None
    if response.stop_reason == "refusal":
        return None
    return response.parsed_output


_MINUTES = re.compile(r"(\d{1,3})\s*(?:דק|דקות|min)")


def _analyze_offline(text: str, category: str, linked: dict | None) -> FeedbackAnalysis:
    actions: list[FieldAction] = []
    if category in ("bug", "idea"):
        actions.append(FieldAction(kind="app_problem" if category == "bug" else "idea", text_he=text[:300]))
    elif linked:
        m = _MINUTES.search(text)
        if m:
            actions.append(FieldAction(kind="service_time", customer_id=linked["customer_id"], minutes=int(m.group(1)), text_he=text[:300]))
        actions.append(FieldAction(kind="customer_note", customer_id=linked["customer_id"], text_he=text[:300]))
    return FeedbackAnalysis(
        category="field_data" if linked and category not in ("bug", "idea") else category,  # type: ignore[arg-type]
        summary_he=text[:120],
        actions=actions,
    )


def _apply_service_time(db: Session, customer: Customer, minutes: int, route: Route | None) -> str:
    minutes = max(1, min(MAX_SERVICE_MIN, minutes))
    customer.default_service_min = minutes
    # Learned customers: move the estimate toward the field report right away;
    # real visits keep refining it afterwards.
    if customer.learned_service_min is not None and customer.service_sample_count >= 3:
        customer.learned_service_min = (customer.learned_service_min + minutes) / 2
        customer.learned_service_p80 = max(customer.learned_service_p80 or minutes, float(minutes))
    if route is not None:
        for s in route.stops or []:
            if s.customer_id == customer.id and s.status == "pending":
                s.service_duration_min = minutes
                s.service_estimate_source = "default"
    return f"זמן שהייה אצל «{customer.name}» עודכן ל־{minutes} דק'"


_HM = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def _apply_hours(customer: Customer, kind: str, hm: str, route: Route | None) -> str | None:
    """Today's open stops of this customer get the opening/closing time as a window."""
    m = _HM.match(hm.strip())
    if not m or route is None:
        return None
    from datetime import time as dtime

    t = dtime(int(m.group(1)), int(m.group(2)))
    touched = False
    for s in route.stops or []:
        if s.customer_id != customer.id or s.status != "pending":
            continue
        if kind == "opens_at":
            s.tw_start = t
            s.tw_type = "window" if s.tw_type in ("before", "window") and s.tw_end else "after"
        else:
            s.tw_end = t
            s.tw_type = "window" if s.tw_type in ("after", "window") and s.tw_start else "before"
        touched = True
    if not touched:
        return None
    word = "מ־" if kind == "opens_at" else "עד "
    return f"«{customer.name}» היום: {word}{t.strftime('%H:%M')}"


def _apply_note(customer: Customer, text: str) -> str:
    stamp = datetime.now(JERUSALEM).strftime("%d/%m")
    line = f"[שטח {stamp}] {text.strip()}"
    customer.notes = f"{customer.notes}\n{line}" if customer.notes else line
    return f"נשמרה הערה ל«{customer.name}»"


async def _open_issue(fb: Feedback, user: User, analysis: FeedbackAnalysis) -> str | None:
    s = get_settings()
    token, repo = s.github_feedback_token.strip(), s.github_feedback_repo.strip()
    if not token or not repo:
        return None
    kind = "תקלה" if analysis.category == "bug" else "רעיון" if analysis.category == "idea" else "הערה"
    body = (
        f"**{kind} מהשטח** · משתמש `{user.username}` · מסך `{fb.screen or '-'}` · גרסה `{fb.app_version or '-'}`\n\n"
        f"> {fb.text}\n\n"
        f"**סיכום:** {analysis.summary_he}\n\n"
        f"route_id={fb.route_id} stop_id={fb.stop_id} feedback_id={fb.id}"
    )
    labels = ["field-feedback", "bug" if analysis.category == "bug" else "enhancement"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                f"https://api.github.com/repos/{repo}/issues",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                json={"title": f"[{kind}] {analysis.summary_he[:80]}", "body": body, "labels": labels},
            )
            res.raise_for_status()
            return res.json().get("html_url")
    except httpx.HTTPError:
        logger.exception("Could not open GitHub issue for feedback %s", fb.id)
        return None


async def submit_feedback(
    db: Session,
    user: User,
    *,
    text: str,
    category: str,
    route_id: int | None,
    stop_id: int | None,
    screen: str | None,
    app_version: str | None,
) -> dict:
    from src.services.forecast import live_reforecast

    route = (
        db.query(Route).filter(Route.id == route_id, Route.user_id == user.id).first() if route_id else None
    )
    stop = None
    if stop_id and route is not None:
        stop = next((s for s in route.stops or [] if s.id == stop_id), None)
    candidates = _candidates(db, route, stop, text)
    linked = next((c for c in candidates if stop and c["customer_id"] == stop.customer_id), None)

    fb = Feedback(
        user_id=user.id,
        route_id=route.id if route else None,
        stop_id=stop.id if stop else None,
        customer_id=stop.customer_id if stop else None,
        category=category if category in ("field_data", "bug", "idea", "other") else "other",
        text=text.strip()[:2000],
        screen=(screen or "")[:64] or None,
        app_version=(app_version or "")[:32] or None,
    )
    db.add(fb)
    db.flush()

    analysis = await _analyze_with_claude(fb.text, candidates, linked)
    if analysis is None:
        analysis = _analyze_offline(fb.text, fb.category, linked)

    allowed = {c["customer_id"] for c in candidates}
    applied: list[str] = []
    service_changed = False
    dev_items = 0
    for act in analysis.actions:
        if act.kind in ("service_time", "customer_note", "opens_at", "closes_at"):
            if act.customer_id not in allowed:
                continue
            customer = db.get(Customer, act.customer_id)
            if customer is None:
                continue
            if act.kind == "service_time" and act.minutes:
                applied.append(_apply_service_time(db, customer, act.minutes, route))
                service_changed = True
            elif act.kind == "customer_note" and act.text_he.strip():
                applied.append(_apply_note(customer, act.text_he))
            elif act.kind in ("opens_at", "closes_at") and act.time_hm:
                msg = _apply_hours(customer, act.kind, act.time_hm, route)
                if msg:
                    applied.append(msg)
                    service_changed = True
        else:
            dev_items += 1

    fb.category = analysis.category
    fb.ai_summary = analysis.summary_he
    fb.ai_actions = [a.model_dump() for a in analysis.actions]
    fb.applied = applied
    if dev_items or analysis.category in ("bug", "idea"):
        fb.issue_url = await _open_issue(fb, user, analysis)
        if fb.issue_url:
            applied.append("הועבר לצוות הפיתוח")
    fb.status = "applied" if applied else "received"
    db.commit()

    if service_changed and route is not None and route.status == "in_progress":
        try:
            await live_reforecast(db, route, force=True)
        except Exception:  # noqa: BLE001 — never fail the note because of a forecast
            logger.exception("re-forecast after feedback failed")
            db.rollback()

    return {
        "id": fb.id,
        "summary_he": fb.ai_summary,
        "applied": applied,
        "forwarded": bool(fb.issue_url),
        "status": fb.status,
    }


def list_feedback(db: Session, user: User, limit: int = 30) -> list[dict]:
    rows = (
        db.query(Feedback)
        .filter(Feedback.user_id == user.id)
        .order_by(Feedback.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "text": r.text,
            "summary_he": r.ai_summary,
            "applied": r.applied or [],
            "status": r.status,
            "forwarded": bool(r.issue_url),
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
