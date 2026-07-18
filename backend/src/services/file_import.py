"""Parse xlsx/csv imports into draft stop rows."""

from __future__ import annotations

import io
from typing import BinaryIO

import pandas as pd

from src.core.exceptions import AppError

NAME_COLS = ("שם", "לקוח", "שם לקוח", "customer", "name", "client")
ADDR_COLS = ("כתובת", "address", "addr")
TIME_COLS = ("שעה", "עד", "הערה", "זמן", "time", "note", "notes")


def _pick_column(columns: list[str], candidates: tuple[str, ...]) -> str | None:
    lower_map = {c: str(c).strip().casefold() for c in columns}
    for cand in candidates:
        cand_l = cand.casefold()
        for original, lowered in lower_map.items():
            if cand_l == lowered or cand_l in lowered:
                return original
    return None


def parse_stops_file(filename: str, raw: bytes) -> list[dict]:
    name = (filename or "").lower()
    bio: BinaryIO = io.BytesIO(raw)
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(bio)
        elif name.endswith(".xlsx") or name.endswith(".xls"):
            df = pd.read_excel(bio)
        else:
            raise AppError(
                code="unsupported_file",
                message_he="נתמכים רק קבצי Excel או CSV.",
                status_code=400,
            )
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            code="file_parse_error",
            message_he="לא הצלחנו לקרוא את הקובץ. בדקו את הפורמט ונסו שוב.",
            status_code=422,
        ) from exc

    if df.empty:
        return []

    cols = list(df.columns)
    name_col = _pick_column(cols, NAME_COLS)
    addr_col = _pick_column(cols, ADDR_COLS)
    time_col = _pick_column(cols, TIME_COLS)

    if not addr_col:
        raise AppError(
            code="missing_address_column",
            message_he="לא נמצאה עמודת כתובת בקובץ (חפשו כותרת כמו 'כתובת').",
            status_code=422,
        )

    drafts: list[dict] = []
    for _, row in df.iterrows():
        address = str(row.get(addr_col) or "").strip()
        if not address or address.lower() == "nan":
            continue
        customer_name = ""
        if name_col:
            customer_name = str(row.get(name_col) or "").strip()
            if customer_name.lower() == "nan":
                customer_name = ""
        if not customer_name:
            customer_name = address.split(",")[0].strip() or "לקוח"
        time_note = None
        if time_col:
            raw_note = str(row.get(time_col) or "").strip()
            if raw_note and raw_note.lower() != "nan":
                time_note = raw_note
        drafts.append(
            {
                "customer_name": customer_name,
                "address": address,
                "time_note": time_note,
            }
        )
    return drafts
