"""Telegram prefs on user_settings.

Revision ID: 004_telegram
Revises: 003_phase5
Create Date: 2026-07-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_telegram"
down_revision: Union[str, None] = "003_phase5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("telegram_chat_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column(
            "telegram_enabled",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "telegram_enabled")
    op.drop_column("user_settings", "telegram_chat_id")
