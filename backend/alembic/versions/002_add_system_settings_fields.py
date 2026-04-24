"""Add missing system_settings columns

Revision ID: 002
Revises: 001
Create Date: 2026-04-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns to system_settings table
    op.add_column('system_settings', sa.Column('similar_artist_per_seed_limit', sa.Integer(), default=5, nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'similar_artist_per_seed_limit')