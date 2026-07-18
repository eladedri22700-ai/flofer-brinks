from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.deps import get_current_user
from src.core.config import get_settings
from src.core.exceptions import AppError
from src.db.session import get_db
from src.models.depot import Depot
from src.models.user import User
from src.models.user_settings import UserSettings
from src.schemas.settings import (
    DepotOut,
    DepotUpdate,
    KeysStatusResponse,
    KeysUpdateRequest,
    PublicConfigResponse,
    TelegramTestResponse,
    UserPrefsOut,
    UserPrefsUpdate,
)
from src.services import maps
from src.services import telegram_notify
from src.services.secrets import keys_status, write_secrets

router = APIRouter(prefix="/settings", tags=["settings"])


def _depot_out(depot: Depot) -> DepotOut:
    return DepotOut(
        id=depot.id,
        name=depot.name,
        address=depot.address,
        lat=depot.lat,
        lng=depot.lng,
    )


def _get_or_create_depot(db: Session) -> Depot:
    depot = db.query(Depot).order_by(Depot.id.asc()).first()
    if depot is None:
        depot = Depot(
            name="משרדי ברינקס",
            address="",
            lat=32.0853,
            lng=34.7818,
        )
        db.add(depot)
        db.commit()
        db.refresh(depot)
    return depot


def _prefs_out(row: UserSettings) -> UserPrefsOut:
    return UserPrefsOut(
        geofence_radius_m=row.geofence_radius_m,
        sos_phone=row.sos_phone,
        standard_day_min=row.standard_day_min,
        standard_week_min=row.standard_week_min,
        theme=row.theme,
        demo_mode=bool(row.demo_mode),
        telegram_chat_id=row.telegram_chat_id,
        telegram_enabled=bool(row.telegram_enabled),
    )


def _get_or_create_settings(db: Session, user_id: int) -> UserSettings:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/keys/status", response_model=KeysStatusResponse)
def get_keys_status(_user: User = Depends(get_current_user)) -> KeysStatusResponse:
    return KeysStatusResponse(**keys_status())


@router.put("/keys", response_model=KeysStatusResponse)
def put_keys(
    body: KeysUpdateRequest,
    _user: User = Depends(get_current_user),
) -> KeysStatusResponse:
    write_secrets(
        google_maps_server_key=body.google_maps_server_key,
        google_maps_browser_key=body.google_maps_browser_key,
        anthropic_api_key=body.anthropic_api_key,
        telegram_bot_token=body.telegram_bot_token,
    )
    return KeysStatusResponse(**keys_status())


@router.get("/public-config", response_model=PublicConfigResponse)
def public_config(_user: User = Depends(get_current_user)) -> PublicConfigResponse:
    s = get_settings()
    status = keys_status()
    return PublicConfigResponse(
        google_maps_browser_key=s.google_maps_browser_key or None,
        maps_mode=status["maps_mode"],
        ocr_mode=status["ocr_mode"],
    )


@router.get("/prefs", response_model=UserPrefsOut)
def get_prefs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPrefsOut:
    return _prefs_out(_get_or_create_settings(db, user.id))


@router.put("/prefs", response_model=UserPrefsOut)
def put_prefs(
    body: UserPrefsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserPrefsOut:
    row = _get_or_create_settings(db, user.id)
    data = body.model_dump(exclude_unset=True)
    if "geofence_radius_m" in data and data["geofence_radius_m"] is not None:
        if data["geofence_radius_m"] < 50 or data["geofence_radius_m"] > 500:
            raise AppError(
                code="bad_geofence",
                message_he="רדיוס גיאופנס חייב להיות בין 50 ל-500 מטר.",
                status_code=400,
            )
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _prefs_out(row)


@router.post("/telegram/test", response_model=TelegramTestResponse)
async def post_telegram_test(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TelegramTestResponse:
    """Send a one-off test message so leaders can verify Telegram setup."""
    status = keys_status()
    if not status.get("telegram"):
        return TelegramTestResponse(
            ok=False,
            message_he="חסר טוקן בוט. שמרו TELEGRAM_BOT_TOKEN בהגדרות המפתחות.",
        )
    row = _get_or_create_settings(db, user.id)
    chat = (row.telegram_chat_id or "").strip()
    if not chat:
        return TelegramTestResponse(
            ok=False,
            message_he="חסר Chat ID. פתחו את הבוט, לחצו Start, והזינו את המזהה כאן.",
        )
    sent = await telegram_notify.send_telegram(
        chat,
        "FLOFER BRINKS — בדיקת התראות הצליחה. אתם מוכנים לקבל עדכוני שטח.",
    )
    if not sent:
        return TelegramTestResponse(
            ok=False,
            message_he="השליחה נכשלה. בדקו שהבוט פעיל, ש־Chat ID נכון, ושלחצתם Start.",
        )
    if not row.telegram_enabled:
        return TelegramTestResponse(
            ok=True,
            message_he="הודעת בדיקה נשלחה. הפעילו את המתג «התראות Telegram» כדי לקבל עדכונים בנסיעה.",
        )
    return TelegramTestResponse(ok=True, message_he="הודעת בדיקה נשלחה לטלגרם.")


@router.get("/depot", response_model=DepotOut)
def get_depot(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> DepotOut:
    """Start/end point of every round (the Brinks office)."""
    return _depot_out(_get_or_create_depot(db))


@router.put("/depot", response_model=DepotOut)
async def put_depot(
    body: DepotUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> DepotOut:
    """Save the office start/end point. Geocodes the address when coords are absent."""
    depot = _get_or_create_depot(db)
    if body.name is not None and body.name.strip():
        depot.name = body.name.strip()

    lat, lng = body.lat, body.lng
    if body.address is not None:
        depot.address = body.address.strip()
        if (lat is None or lng is None) and depot.address:
            geo = await maps.geocode(depot.address)
            lat = geo.get("lat")
            lng = geo.get("lng")
            if lat is None or lng is None:
                raise AppError(
                    code="geocode_failed",
                    message_he="לא הצלחנו למצוא את הכתובת. הזינו קואורדינטות ידנית.",
                    status_code=400,
                )

    if lat is not None and lng is not None:
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise AppError(
                code="bad_coords",
                message_he="קואורדינטות לא תקינות.",
                status_code=400,
            )
        depot.lat = lat
        depot.lng = lng

    db.commit()
    db.refresh(depot)
    return _depot_out(depot)
