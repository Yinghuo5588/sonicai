"""Add playlist retention policies

Revision ID: 022
Revises: 021
Create Date: 2026-05-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "playlist_retention_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("playlist_type", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("keep_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delete_navidrome", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("keep_recent_success_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("playlist_type", name="uq_playlist_retention_policies_type"),
    )


def downgrade() -> None:
    op.drop_table("playlist_retention_policies")
