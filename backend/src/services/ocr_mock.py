"""Mock OCR drafts for demo without Anthropic key."""

from __future__ import annotations


def extract_drafts() -> list[dict]:
    return [
        {
            "customer_name": "בנק הפועלים דיזנגוף",
            "address": "דיזנגוף 50, תל אביב-יפו",
            "time_note": "עד 10:00",
        },
        {
            "customer_name": "כספומט רוטשילד",
            "address": "רוטשילד 22, תל אביב-יפו",
            "time_note": None,
        },
        {
            "customer_name": "סופר פארם אבן גבירול",
            "address": "אבן גבירול 71, תל אביב-יפו",
            "time_note": "בין 11:00 ל-13:00",
        },
        {
            "customer_name": "סניף חולון",
            "address": "אזור התעשייה חולון",
            "time_note": "משעה 14:00",
        },
    ]
