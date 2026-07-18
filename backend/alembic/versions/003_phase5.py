"""Phase 5: demo flags + is_demo on routes.

Revision ID: 003_phase5
Revises: 002_live_mode
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_phase5"
down_revision: Union[str, None] = "002_live_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("demo_mode", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "routes",
        sa.Column("is_demo", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("routes", "is_demo")
    op.drop_column("user_settings", "demo_mode")
