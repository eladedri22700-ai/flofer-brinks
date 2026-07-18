from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    tw_type: Mapped[str] = mapped_column(String(16), nullable=False, default="none")
    tw_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    tw_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    service_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    service_estimate_source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="default"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_arrival: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_departure: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_park_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_park_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    exception_code: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    exception_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    route = relationship("Route", back_populates="stops")
    customer = relationship("Customer", back_populates="stops")
    service_samples = relationship("ServiceSample", back_populates="stop")
