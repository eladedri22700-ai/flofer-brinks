"""Initial schema — 10 foundation tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "depots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("normalized_address", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("default_service_min", sa.Integer(), nullable=True),
        sa.Column("learned_service_min", sa.Float(), nullable=True),
        sa.Column("learned_service_p80", sa.Float(), nullable=True),
        sa.Column("service_sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parking_lat", sa.Float(), nullable=True),
        sa.Column("parking_lng", sa.Float(), nullable=True),
        sa.Column("parking_sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("geocode_confidence", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "normalized_address", name="uq_customer_name_address"),
    )
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("standard_day_min", sa.Integer(), nullable=False, server_default="516"),
        sa.Column("standard_week_min", sa.Integer(), nullable=False, server_default="2520"),
        sa.Column("geofence_radius_m", sa.Integer(), nullable=False, server_default="150"),
        sa.Column("theme", sa.String(length=16), nullable=False, server_default="dark"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("departure_time", sa.Time(), nullable=False),
        sa.Column("break_duration_min", sa.Integer(), nullable=False),
        sa.Column("break_window_start", sa.Time(), nullable=False),
        sa.Column("break_window_end", sa.Time(), nullable=False),
        sa.Column("deadline_buffer_min", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("vip_weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("variance_mode", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("optimized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("naive_duration_min", sa.Integer(), nullable=True),
        sa.Column("optimized_duration_min", sa.Integer(), nullable=True),
        sa.Column("solver_explanation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "stops",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("route_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("customer_name", sa.String(length=128), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("sequence_order", sa.Integer(), nullable=False),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("tw_type", sa.String(length=16), nullable=False),
        sa.Column("tw_start", sa.Time(), nullable=True),
        sa.Column("tw_end", sa.Time(), nullable=True),
        sa.Column("service_duration_min", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("service_estimate_source", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("eta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_departure", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_park_lat", sa.Float(), nullable=True),
        sa.Column("actual_park_lng", sa.Float(), nullable=True),
        sa.Column("exception_code", sa.String(length=32), nullable=False),
        sa.Column("exception_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "route_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("route_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "work_days",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("route_id", sa.Integer(), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("break_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("driving_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("service_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("waiting_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_min", sa.Integer(), nullable=True),
        sa.Column("overtime_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("manually_edited", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("edit_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_work_days_user_date"),
    )
    op.create_table(
        "service_samples",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("stop_id", sa.Integer(), nullable=False),
        sa.Column("duration_min", sa.Float(), nullable=False),
        sa.Column("day_bucket", sa.String(length=32), nullable=False),
        sa.Column("hour_bucket", sa.Integer(), nullable=False),
        sa.Column("exception_code", sa.String(length=32), nullable=False),
        sa.Column("is_outlier", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["stop_id"], ["stops.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "leg_samples",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("from_lat", sa.Float(), nullable=False),
        sa.Column("from_lng", sa.Float(), nullable=False),
        sa.Column("to_lat", sa.Float(), nullable=False),
        sa.Column("to_lng", sa.Float(), nullable=False),
        sa.Column("from_customer_id", sa.Integer(), nullable=True),
        sa.Column("to_customer_id", sa.Integer(), nullable=True),
        sa.Column("hour_bucket", sa.Integer(), nullable=False),
        sa.Column("day_bucket", sa.String(length=32), nullable=False),
        sa.Column("predicted_min", sa.Float(), nullable=False),
        sa.Column("actual_min", sa.Float(), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["from_customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["to_customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("leg_samples")
    op.drop_table("service_samples")
    op.drop_table("work_days")
    op.drop_table("route_events")
    op.drop_table("stops")
    op.drop_table("routes")
    op.drop_table("user_settings")
    op.drop_table("customers")
    op.drop_table("depots")
    op.drop_table("users")
