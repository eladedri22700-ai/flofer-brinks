"""Learning baseline, live position, web push and field feedback.

Revision ID: 005_learn_push_fb
Revises: 004_telegram
Create Date: 2026-10-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_learn_push_fb"
down_revision: Union[str, None] = "004_telegram"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # What the system predicted, kept separately from the live forecast (stops.eta)
    op.add_column("stops", sa.Column("planned_eta", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stops", sa.Column("planned_leg_raw_min", sa.Float(), nullable=True))
    op.add_column(
        "leg_samples",
        sa.Column("predicted_source", sa.String(16), server_default="estimate", nullable=False),
    )

    op.add_column("routes", sa.Column("last_lat", sa.Float(), nullable=True))
    op.add_column("routes", sa.Column("last_lng", sa.Float(), nullable=True))
    op.add_column("routes", sa.Column("last_pos_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("routes", sa.Column("live_eta_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(255), nullable=False),
        sa.Column("auth", sa.String(255), nullable=False),
        sa.Column("failures", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_ok_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])

    op.create_table(
        "notification_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("dedupe_key", sa.String(128), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "kind", "dedupe_key", name="uq_notification_dedupe"),
    )

    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("routes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stop_id", sa.Integer(), sa.ForeignKey("stops.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(24), nullable=False, server_default="other"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("screen", sa.String(64), nullable=True),
        sa.Column("app_version", sa.String(32), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_actions", postgresql.JSONB(), nullable=True),
        sa.Column("applied", postgresql.JSONB(), nullable=True),
        sa.Column("issue_url", sa.String(255), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_table("feedback")
    op.drop_table("notification_log")
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    for col in ("live_eta_at", "last_pos_at", "last_lng", "last_lat"):
        op.drop_column("routes", col)
    op.drop_column("leg_samples", "predicted_source")
    op.drop_column("stops", "planned_leg_raw_min")
    op.drop_column("stops", "planned_eta")
