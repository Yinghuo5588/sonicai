"""Add cron_created_by_user_id

Revision ID: 020
Revises: 019
Create Date: 2026-05-06
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("cron_created_by_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cron_owner_user",
        "system_settings", "users",
        ["cron_created_by_user_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_cron_owner_user", "system_settings", type_="foreignkey")
    op.drop_column("system_settings", "cron_created_by_user_id")