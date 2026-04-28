"""Add max_concurrent_tasks field

Revision ID: 008
Revises: 007
Create Date: 2026-04-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_settings', sa.Column('max_concurrent_tasks', sa.Integer(), default=2, nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'max_concurrent_tasks')
