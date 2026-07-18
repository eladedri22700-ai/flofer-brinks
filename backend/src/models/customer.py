from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("name", "normalized_address", name="uq_customer_name_address"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    normalized_address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    default_service_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    learned_service_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    learned_service_p80: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parking_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    parking_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    parking_sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parking_fixes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    geocode_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    stops = relationship("Stop", back_populates="customer")
    service_samples = relationship("ServiceSample", back_populates="customer")
