"""Add song cache settings

Revision ID: 009
Revises: 008
Create Date: 2026-04-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("song_cache_enabled", sa.Boolean(), nullable=True, server_default=sa.true()),
    )
    op.add_column(
        "system_settings",
        sa.Column("song_cache_auto_refresh_enabled", sa.Boolean(), nullable=True, server_default=sa.true()),
    )
    op.add_column(
        "system_settings",
        sa.Column("song_cache_refresh_cron", sa.String(length=100), nullable=True, server_default="0 4 * * *"),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "song_cache_refresh_cron")
    op.drop_column("system_settings", "song_cache_auto_refresh_enabled")
    op.drop_column("system_settings", "song_cache_enabled")
