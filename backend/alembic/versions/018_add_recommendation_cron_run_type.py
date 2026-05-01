"""Add recommendation_cron_run_type setting

Revision ID: 018
Revises: 017
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column(
            "recommendation_cron_run_type",
            sa.String(length=30),
            nullable=True,
            server_default="full",
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "recommendation_cron_run_type")