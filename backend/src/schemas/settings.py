from pydantic import BaseModel, Field


class KeysUpdateRequest(BaseModel):
    google_maps_server_key: str | None = None
    google_maps_browser_key: str | None = None
    anthropic_api_key: str | None = None
    telegram_bot_token: str | None = None


class KeysStatusResponse(BaseModel):
    google_server: bool
    google_browser: bool
    anthropic: bool
    telegram: bool = False
    maps_mode: str = Field(description="mock | live")
    ocr_mode: str = Field(description="mock | live")
    telegram_mode: str = Field(default="off", description="off | live")


class PublicConfigResponse(BaseModel):
    google_maps_browser_key: str | None = None
    maps_mode: str
    ocr_mode: str


class UserPrefsOut(BaseModel):
    geofence_radius_m: int
    sos_phone: str | None = None
    standard_day_min: int
    standard_week_min: int
    theme: str
    demo_mode: bool = False
    telegram_chat_id: str | None = None
    telegram_enabled: bool = False


class UserPrefsUpdate(BaseModel):
    geofence_radius_m: int | None = None
    sos_phone: str | None = None
    standard_day_min: int | None = None
    standard_week_min: int | None = None
    theme: str | None = Field(default=None, pattern="^(light|dark)$")
    telegram_chat_id: str | None = None
    telegram_enabled: bool | None = None


class DepotOut(BaseModel):
    id: int
    name: str
    address: str
    lat: float
    lng: float


class DepotUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None


class TelegramTestResponse(BaseModel):
    ok: bool
    message_he: str
