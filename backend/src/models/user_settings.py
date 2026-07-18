from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False
    )
    standard_day_min: Mapped[int] = mapped_column(Integer, nullable=False, default=516)
    standard_week_min: Mapped[int] = mapped_column(Integer, nullable=False, default=2520)
    geofence_radius_m: Mapped[int] = mapped_column(Integer, nullable=False, default=150)
    sos_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    demo_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="light")
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="settings")
