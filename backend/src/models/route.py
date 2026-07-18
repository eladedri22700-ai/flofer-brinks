from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Time,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planning")
    departure_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    break_window_start: Mapped[time] = mapped_column(Time, nullable=False)
    break_window_end: Mapped[time] = mapped_column(Time, nullable=False)
    deadline_buffer_min: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    vip_weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    variance_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    optimized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    naive_duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    optimized_duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    solver_explanation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", back_populates="routes")
    stops = relationship("Stop", back_populates="route")
    events = relationship("RouteEvent", back_populates="route")
    work_days = relationship("WorkDay", back_populates="route")
