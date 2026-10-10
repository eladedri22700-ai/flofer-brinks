"""Web Push (VAPID) — notifications that reach the phone even when the app is closed.

The VAPID key pair is derived deterministically from JWT_SECRET, so it stays
stable across deploys without any extra configuration (rotating JWT_SECRET
means phones re-subscribe on next open, which the app does automatically).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.models.push_subscription import NotificationLog, PushSubscription

logger = logging.getLogger(__name__)

_P256_ORDER = int("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


@lru_cache
def _vapid_key() -> ec.EllipticCurvePrivateKey:
    seed = hashlib.sha256(("vapid:" + get_settings().jwt_secret).encode()).digest()
    scalar = int.from_bytes(seed, "big") % (_P256_ORDER - 1) + 1
    return ec.derive_private_key(scalar, ec.SECP256R1())


def public_key_b64() -> str:
    """Application server key for PushManager.subscribe (uncompressed point, base64url)."""
    point = _vapid_key().public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return _b64url(point)


def _private_key_raw_b64() -> str:
    """Raw 32-byte private scalar, base64url — the form pywebpush/py_vapid accepts."""
    scalar = _vapid_key().private_numbers().private_value
    return _b64url(scalar.to_bytes(32, "big"))


def subscribe(db: Session, user_id: int, endpoint: str, p256dh: str, auth: str) -> None:
    row = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if row is None:
        row = PushSubscription(endpoint=endpoint, user_id=user_id, p256dh=p256dh, auth=auth)
        db.add(row)
    else:
        row.user_id, row.p256dh, row.auth, row.failures = user_id, p256dh, auth, 0
    db.commit()


def unsubscribe(db: Session, endpoint: str) -> None:
    db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).delete()
    db.commit()


def _send_one(sub: PushSubscription, payload: str) -> int:
    """Blocking send. Returns HTTP status (0 = network error)."""
    from pywebpush import WebPushException, webpush

    url = get_settings().app_public_url or ""
    # Push services require a https: or mailto: contact in the VAPID claims
    contact = url if url.startswith("https://") else "mailto:noreply@flofer-brinks.app"
    try:
        resp = webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=payload,
            vapid_private_key=_private_key_raw_b64(),
            vapid_claims={"sub": contact},
            ttl=60 * 30,
            headers={"Urgency": "high"},
        )
        return getattr(resp, "status_code", 201)
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", 0) if exc.response is not None else 0
        logger.warning("Web push failed (%s): %s", status, str(exc)[:200])
        return status
    except Exception:  # noqa: BLE001
        logger.exception("Web push error")
        return 0


async def send_to_user(
    db: Session,
    user_id: int,
    *,
    title: str,
    body: str,
    url: str = "/app/live",
    tag: str = "flofer",
) -> int:
    """Send to every device of the user. Returns how many devices accepted it."""
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        return 0
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag}, ensure_ascii=False)
    ok = 0
    for sub in subs:
        status = await asyncio.to_thread(_send_one, sub, payload)
        if 200 <= status < 300:
            ok += 1
            sub.failures = 0
            sub.last_ok_at = datetime.now(timezone.utc)
        elif status in (404, 410):
            db.delete(sub)  # the browser revoked this subscription
        else:
            sub.failures += 1
            if sub.failures >= 5:
                db.delete(sub)
    db.commit()
    return ok


def claim_once(db: Session, user_id: int, route_id: int | None, kind: str, key: str) -> bool:
    """True the first time (user, kind, key) is seen — dedupes repeated alerts."""
    db.add(NotificationLog(user_id=user_id, route_id=route_id, kind=kind, dedupe_key=key[:128]))
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False
