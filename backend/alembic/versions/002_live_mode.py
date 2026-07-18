"""Add sos_phone and parking_fixes for Live Mode.

Revision ID: 002_live_mode
Revises: 001_initial
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_live_mode"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("sos_phone", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column(
            "parking_fixes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("customers", "parking_fixes")
    op.drop_column("user_settings", "sos_phone")
