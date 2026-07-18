from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class WorkDay(Base):
    __tablename__ = "work_days"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_work_days_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    break_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    driving_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    service_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    waiting_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overtime_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    manually_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    edit_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", back_populates="work_days")
    route = relationship("Route", back_populates="work_days")
