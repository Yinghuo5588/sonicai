"""Add playlist cleanup settings

Revision ID: 021
Revises: 020
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_cleanup_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_cleanup_cron",
            sa.String(length=100),
            nullable=True,
            server_default="30 3 * * *",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_cleanup_delete_navidrome",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_cleanup_keep_failed",
            sa.Boolean(),
            nullable=True,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_cleanup_keep_recent_success_count",
            sa.Integer(),
            nullable=True,
            server_default="2",
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "playlist_cleanup_keep_recent_success_count")
    op.drop_column("system_settings", "playlist_cleanup_keep_failed")
    op.drop_column("system_settings", "playlist_cleanup_delete_navidrome")
    op.drop_column("system_settings", "playlist_cleanup_cron")
    op.drop_column("system_settings", "playlist_cleanup_enabled")