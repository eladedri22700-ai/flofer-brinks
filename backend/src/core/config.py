from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
SECRETS_PATH = BACKEND_DIR / ".secrets.env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), str(SECRETS_PATH)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = (
        "postgresql+psycopg2://routemaster:routemaster@localhost:5432/routemaster"
    )
    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_expire_hours: int = 24
    google_maps_server_key: str = ""
    google_maps_browser_key: str = ""
    anthropic_api_key: str = ""
    telegram_bot_token: str = ""
    app_public_url: str = "http://127.0.0.1:5180"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5180,http://127.0.0.1:5180,"
        "http://localhost:3100,http://127.0.0.1:3100"
    )
    demo_auth: bool = True
    serve_frontend: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        """Normalize Render/Heroku postgres:// URLs for SQLAlchemy + psycopg2."""
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg2://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+psycopg2" not in url:
            return "postgresql+psycopg2://" + url[len("postgresql://") :]
        return url

    @property
    def maps_live(self) -> bool:
        return bool(self.google_maps_server_key.strip())

    @property
    def ocr_live(self) -> bool:
        return bool(self.anthropic_api_key.strip())

    @property
    def telegram_live(self) -> bool:
        return bool(self.telegram_bot_token.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()
