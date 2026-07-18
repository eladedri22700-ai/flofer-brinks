from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class ServiceSample(Base):
    __tablename__ = "service_samples"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    stop_id: Mapped[int] = mapped_column(ForeignKey("stops.id"), nullable=False)
    duration_min: Mapped[float] = mapped_column(Float, nullable=False)
    day_bucket: Mapped[str] = mapped_column(String(32), nullable=False)
    hour_bucket: Mapped[int] = mapped_column(Integer, nullable=False)
    exception_code: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    is_outlier: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    customer = relationship("Customer", back_populates="service_samples")
    stop = relationship("Stop", back_populates="service_samples")
