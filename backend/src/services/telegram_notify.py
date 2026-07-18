"""Telegram Bot notifications — never blocks the driver on failure."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.models.user_settings import UserSettings

logger = logging.getLogger(__name__)


def _chat_id_for_user(db: Session, user_id: int) -> str | None:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row is None or not row.telegram_enabled:
        return None
    chat = (row.telegram_chat_id or "").strip()
    return chat or None


async def send_telegram(chat_id: str, text: str) -> bool:
    token = get_settings().telegram_bot_token.strip()
    if not token:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
            )
            if res.status_code >= 400:
                logger.warning("Telegram send failed: %s %s", res.status_code, res.text[:200])
                return False
            return True
    except Exception:
        logger.exception("Telegram send error")
        return False


async def notify_user(db: Session, user_id: int, text: str) -> bool:
    chat_id = _chat_id_for_user(db, user_id)
    if not chat_id:
        return False
    return await send_telegram(chat_id, text)


async def notify_event(
    db: Session,
    user_id: int,
    *,
    kind: str,
    customer_name: str | None = None,
    extra: dict[str, Any] | None = None,
    app_base_url: str | None = None,
) -> bool:
    link = ""
    if app_base_url:
        link = f"\n{app_base_url.rstrip('/')}/app/live"

    name = customer_name or "יעד"
    if kind == "approach":
        meters = (extra or {}).get("distance_m")
        dist = f" (~{int(meters)} מ')" if meters is not None else ""
        text = f"מתקרבים ל־{name}{dist}. פתחו את האפליקציה לניווט.{link}"
    elif kind == "arrive":
        text = f"הגעתם ל־{name}? סמנו בוצע באפליקציה.{link}"
    elif kind == "reopt":
        msg = (extra or {}).get("message_he") or "זוהה עיכוב — יש הצעה לסידור מחדש."
        text = f"{msg}{link}"
    elif kind == "break":
        text = f"תזכורת הפסקה — זמן טוב לעצור.{link}"
    elif kind == "summary":
        text = f"הסבב הסתיים. צפו בסיכום היומי.{link}"
    else:
        text = f"FLOFER BRINKS: {kind}{link}"

    return await notify_user(db, user_id, text)
