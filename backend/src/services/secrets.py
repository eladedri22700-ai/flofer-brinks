"""Persist API keys to backend/.secrets.env (gitignored)."""

from __future__ import annotations

from pathlib import Path

from src.core.config import BACKEND_DIR, SECRETS_PATH, get_settings, reload_settings

SECRET_KEYS = (
    "GOOGLE_MAPS_SERVER_KEY",
    "GOOGLE_MAPS_BROWSER_KEY",
    "ANTHROPIC_API_KEY",
    "TELEGRAM_BOT_TOKEN",
)


def _read_secrets_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def write_secrets(
    *,
    google_maps_server_key: str | None = None,
    google_maps_browser_key: str | None = None,
    anthropic_api_key: str | None = None,
    telegram_bot_token: str | None = None,
) -> dict[str, str]:
    current = _read_secrets_file(SECRETS_PATH)
    # Seed from current settings so we don't wipe unrelated values
    settings = get_settings()
    if "GOOGLE_MAPS_SERVER_KEY" not in current and settings.google_maps_server_key:
        current["GOOGLE_MAPS_SERVER_KEY"] = settings.google_maps_server_key
    if "GOOGLE_MAPS_BROWSER_KEY" not in current and settings.google_maps_browser_key:
        current["GOOGLE_MAPS_BROWSER_KEY"] = settings.google_maps_browser_key
    if "ANTHROPIC_API_KEY" not in current and settings.anthropic_api_key:
        current["ANTHROPIC_API_KEY"] = settings.anthropic_api_key
    if "TELEGRAM_BOT_TOKEN" not in current and settings.telegram_bot_token:
        current["TELEGRAM_BOT_TOKEN"] = settings.telegram_bot_token

    if google_maps_server_key is not None and google_maps_server_key.strip():
        current["GOOGLE_MAPS_SERVER_KEY"] = google_maps_server_key.strip()
    if google_maps_browser_key is not None and google_maps_browser_key.strip():
        current["GOOGLE_MAPS_BROWSER_KEY"] = google_maps_browser_key.strip()
    if anthropic_api_key is not None and anthropic_api_key.strip():
        current["ANTHROPIC_API_KEY"] = anthropic_api_key.strip()
    if telegram_bot_token is not None and telegram_bot_token.strip():
        current["TELEGRAM_BOT_TOKEN"] = telegram_bot_token.strip()

    lines = [f"{k}={current[k]}" for k in SECRET_KEYS if k in current and current[k]]
    SECRETS_PATH.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    reload_settings()
    return current


def keys_status() -> dict:
    s = get_settings()
    return {
        "google_server": bool(s.google_maps_server_key.strip()),
        "google_browser": bool(s.google_maps_browser_key.strip()),
        "anthropic": bool(s.anthropic_api_key.strip()),
        "telegram": bool(s.telegram_bot_token.strip()),
        "maps_mode": "live" if s.maps_live else "mock",
        "ocr_mode": "live" if s.ocr_live else "mock",
        "telegram_mode": "live" if s.telegram_live else "off",
    }
