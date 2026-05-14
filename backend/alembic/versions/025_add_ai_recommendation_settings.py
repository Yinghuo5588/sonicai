"""Add AI recommendation settings

Revision ID: 025
Revises: 024
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("ai_enabled", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.add_column(
        "system_settings",
        sa.Column("ai_api_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_base_url",
            sa.String(length=500),
            nullable=True,
            server_default="https://api.openai.com/v1",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_model",
            sa.String(length=100),
            nullable=True,
            server_default="gpt-4o-mini",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_request_timeout",
            sa.Integer(),
            nullable=True,
            server_default="60",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_default_limit",
            sa.Integer(),
            nullable=True,
            server_default="30",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_temperature",
            sa.Numeric(3, 2),
            nullable=True,
            server_default="0.80",
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "ai_temperature")
    op.drop_column("system_settings", "ai_default_limit")
    op.drop_column("system_settings", "ai_request_timeout")
    op.drop_column("system_settings", "ai_model")
    op.drop_column("system_settings", "ai_base_url")
    op.drop_column("system_settings", "ai_api_key")
    op.drop_column("system_settings", "ai_enabled")