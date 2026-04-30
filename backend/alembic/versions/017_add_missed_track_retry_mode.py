"""Add missed_track_retry_mode setting

Revision ID: 017
Revises: 016
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column(
            "missed_track_retry_mode",
            sa.String(length=20),
            nullable=True,
            server_default="local",
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "missed_track_retry_mode")
