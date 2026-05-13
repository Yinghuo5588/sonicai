"""Align library_mode_default default

Revision ID: 024
Revises: 023
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op


revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE system_settings "
        "ALTER COLUMN library_mode_default SET DEFAULT 'allow_missing'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE system_settings "
        "ALTER COLUMN library_mode_default SET DEFAULT 'library_only'"
    )