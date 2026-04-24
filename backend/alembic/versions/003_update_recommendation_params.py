"""Update recommendation parameters

Revision ID: 003
Revises: 002
Create Date: 2026-04-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add new recommendation fields
    op.add_column('system_settings', sa.Column('seed_source_mode', sa.String(length=30), default='recent_plus_top', nullable=True))
    op.add_column('system_settings', sa.Column('recent_tracks_limit', sa.Integer(), default=100, nullable=True))
    op.add_column('system_settings', sa.Column('top_period', sa.String(length=20), default='1month', nullable=True))
    op.add_column('system_settings', sa.Column('recent_top_mix_ratio', sa.Integer(), default=70, nullable=True))
    op.add_column('system_settings', sa.Column('match_threshold', sa.Float(), default=0.75, nullable=True))
    op.add_column('system_settings', sa.Column('candidate_pool_multiplier_min', sa.Float(), default=2.0, nullable=True))
    op.add_column('system_settings', sa.Column('candidate_pool_multiplier_max', sa.Float(), default=10.0, nullable=True))

    # Remove duplicate field
    op.drop_column('system_settings', 'similar_artist_per_seed_limit')

def downgrade() -> None:
    op.add_column('system_settings', sa.Column('similar_artist_per_seed_limit', sa.Integer(), default=5, nullable=True))
    op.drop_column('system_settings', 'candidate_pool_multiplier_max')
    op.drop_column('system_settings', 'candidate_pool_multiplier_min')
    op.drop_column('system_settings', 'match_threshold')
    op.drop_column('system_settings', 'recent_top_mix_ratio')
    op.drop_column('system_settings', 'top_period')
    op.drop_column('system_settings', 'recent_tracks_limit')
    op.drop_column('system_settings', 'seed_source_mode')
