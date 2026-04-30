"""Add missed_track_retry_mode setting

Revision ID: 017
Revises: 016
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column(
        'system_settings',
        sa.Column(
            'missed_track_retry_mode',
            sa.String(20),
            nullable=True,
            server_default='local'
        )
    )

def downgrade():
    op.drop_column('system_settings', 'missed_track_retry_mode')
