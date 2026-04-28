"""Add hotboard and playlist sync cron fields

Revision ID: 007
Revises: 006
Create Date: 2026-04-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hotboard scheduled sync
    op.add_column('system_settings', sa.Column('hotboard_cron_enabled', sa.Boolean(), default=False, nullable=True))
    op.add_column('system_settings', sa.Column('hotboard_cron_expression', sa.String(length=100), nullable=True))
    op.add_column('system_settings', sa.Column('hotboard_limit', sa.Integer(), default=50, nullable=True))
    op.add_column('system_settings', sa.Column('hotboard_match_threshold', sa.Float(), default=0.75, nullable=True))
    op.add_column('system_settings', sa.Column('hotboard_playlist_name', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('hotboard_overwrite', sa.Boolean(), default=True, nullable=True))

    # Playlist URL scheduled sync
    op.add_column('system_settings', sa.Column('playlist_sync_cron_enabled', sa.Boolean(), default=False, nullable=True))
    op.add_column('system_settings', sa.Column('playlist_sync_cron_expression', sa.String(length=100), nullable=True))
    op.add_column('system_settings', sa.Column('playlist_sync_url', sa.String(length=1000), nullable=True))
    op.add_column('system_settings', sa.Column('playlist_sync_threshold', sa.Float(), default=0.75, nullable=True))
    op.add_column('system_settings', sa.Column('playlist_sync_name', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('playlist_sync_overwrite', sa.Boolean(), default=False, nullable=True))

    # Incremental sync: store hash of last synced songs
    op.add_column('system_settings', sa.Column('playlist_sync_last_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'playlist_sync_last_hash')
    op.drop_column('system_settings', 'playlist_sync_overwrite')
    op.drop_column('system_settings', 'playlist_sync_name')
    op.drop_column('system_settings', 'playlist_sync_threshold')
    op.drop_column('system_settings', 'playlist_sync_url')
    op.drop_column('system_settings', 'playlist_sync_cron_expression')
    op.drop_column('system_settings', 'playlist_sync_cron_enabled')
    op.drop_column('system_settings', 'hotboard_overwrite')
    op.drop_column('system_settings', 'hotboard_playlist_name')
    op.drop_column('system_settings', 'hotboard_match_threshold')
    op.drop_column('system_settings', 'hotboard_limit')
    op.drop_column('system_settings', 'hotboard_cron_expression')
    op.drop_column('system_settings', 'hotboard_cron_enabled')
