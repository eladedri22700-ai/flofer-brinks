"""OCR extraction — Anthropic live or mock drafts."""

from __future__ import annotations

import base64
import json
import logging
import re

import httpx
from pydantic import BaseModel, Field, ValidationError

from src.core.config import get_settings
from src.core.exceptions import AppError
from src.services import ocr_mock

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Extract every delivery/pickup destination from this Hebrew logistics app "
    "screenshot. Return ONLY a JSON array, no preamble, no markdown fences. "
    'Schema: [{"customer_name": str, "address": str, "time_note": str|null}]. '
    "Return [] if none found."
)


class ExtractedStop(BaseModel):
    customer_name: str = Field(min_length=1)
    address: str = Field(min_length=1)
    time_note: str | None = None


def _parse_json_array(raw: str) -> list[ExtractedStop]:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AppError(
            code="ocr_parse_error",
            message_he="לא הצלחנו לקרוא את הצילום. נסו תמונה ברורה יותר או הזנה ידנית.",
            status_code=422,
        ) from exc
    if not isinstance(data, list):
        raise AppError(
            code="ocr_parse_error",
            message_he="פורמט החילוץ לא תקין. נסו שוב או הזינו ידנית.",
            status_code=422,
        )
    out: list[ExtractedStop] = []
    for item in data:
        try:
            out.append(ExtractedStop.model_validate(item))
        except ValidationError:
            continue
    return out


def sniff_image_type(content: bytes) -> str | None:
    """Real format from the file bytes — the browser's content-type is often wrong."""
    head = content[:16]
    if head.startswith(bytes([0xFF, 0xD8, 0xFF])):
        return "image/jpeg"
    if head.startswith(bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])):
        return "image/png"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def extract_from_image(content: bytes, content_type: str) -> list[dict]:
    settings = get_settings()
    if not settings.ocr_live:
        return ocr_mock.extract_drafts()

    media = sniff_image_type(content)
    if media is None:
        raise AppError(
            code="unsupported_image",
            message_he=(
                "פורמט התמונה לא נתמך לזיהוי (למשל HEIC או SVG). "
                "צלמו צילום מסך רגיל או שמרו כ־JPG/PNG ונסו שוב."
            ),
            status_code=400,
        )

    b64 = base64.standard_b64encode(content).decode("ascii")
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 2048,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract destinations as JSON array only.",
                    },
                ],
            }
        ],
    }
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            )
            if res.is_error:
                logger.error("Anthropic OCR HTTP %s: %s", res.status_code, res.text[:400])
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        logger.exception("Anthropic OCR failed: %s", exc)
        raise AppError(
            code="ocr_api_error",
            message_he="שגיאה בחילוץ מהצילום. בדקו את מפתח Anthropic או נסו שוב.",
            status_code=502,
        ) from exc

    parts = data.get("content") or []
    text = "".join(p.get("text", "") for p in parts if p.get("type") == "text")
    stops = _parse_json_array(text)
    return [s.model_dump() for s in stops]
