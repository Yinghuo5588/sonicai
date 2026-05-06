"""Add history cleanup settings

Revision ID: 019
Revises: 018
Create Date: 2026-05-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("history_cleanup_enabled", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.add_column(
        "system_settings",
        sa.Column("run_history_keep_days", sa.Integer(), nullable=True, server_default="90"),
    )
    op.add_column(
        "system_settings",
        sa.Column("webhook_history_keep_days", sa.Integer(), nullable=True, server_default="30"),
    )
    op.add_column(
        "system_settings",
        sa.Column("keep_failed_history", sa.Boolean(), nullable=True, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "keep_failed_history")
    op.drop_column("system_settings", "webhook_history_keep_days")
    op.drop_column("system_settings", "run_history_keep_days")
    op.drop_column("system_settings", "history_cleanup_enabled")