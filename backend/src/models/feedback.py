from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class Feedback(Base):
    """A note written in the field — applied to learning and forwarded to development."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    route_id: Mapped[int | None] = mapped_column(
        ForeignKey("routes.id", ondelete="SET NULL"), nullable=True
    )
    stop_id: Mapped[int | None] = mapped_column(
        ForeignKey("stops.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    category: Mapped[str] = mapped_column(String(24), nullable=False, default="other")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    screen: Mapped[str | None] = mapped_column(String(64), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_actions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    applied: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    issue_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
