"""Add match_debug_enabled setting

Revision ID: 015
Revises: 014
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column(
            "match_debug_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "match_debug_enabled")