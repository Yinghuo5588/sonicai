"""Add search_concurrency to system_settings

Revision ID: 006
Revises: 005
Create Date: 2026-04-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('system_settings',
        sa.Column('search_concurrency', sa.Integer(), default=5, nullable=True))

def downgrade() -> None:
    op.drop_column('system_settings', 'search_concurrency')
