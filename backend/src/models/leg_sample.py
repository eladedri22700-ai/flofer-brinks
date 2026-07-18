from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class LegSample(Base):
    __tablename__ = "leg_samples"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    from_lat: Mapped[float] = mapped_column(Float, nullable=False)
    from_lng: Mapped[float] = mapped_column(Float, nullable=False)
    to_lat: Mapped[float] = mapped_column(Float, nullable=False)
    to_lng: Mapped[float] = mapped_column(Float, nullable=False)
    from_customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"), nullable=True
    )
    to_customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"), nullable=True
    )
    hour_bucket: Mapped[int] = mapped_column(Integer, nullable=False)
    day_bucket: Mapped[str] = mapped_column(String(32), nullable=False)
    predicted_min: Mapped[float] = mapped_column(Float, nullable=False)
    actual_min: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
