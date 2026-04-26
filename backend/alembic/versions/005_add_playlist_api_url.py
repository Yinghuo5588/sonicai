"""Add playlist_api_url to system_settings

Revision ID: 005
Revises: 004
Create Date: 2026-04-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005'
down_revision: Union[str, Sequence[str], None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_settings',
        sa.Column('playlist_api_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'playlist_api_url')
