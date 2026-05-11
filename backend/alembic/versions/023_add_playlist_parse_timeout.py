"""Add playlist_parse_timeout setting

Revision ID: 023
Revises: 022
Create Date: 2026-05-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column(
            "playlist_parse_timeout",
            sa.Integer(),
            nullable=True,
            server_default="30",
        ),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "playlist_parse_timeout")