"""Initial migration

Revision ID: 001
Revises:
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_superuser', sa.Boolean(), default=False),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email'),
    )

    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timezone', sa.String(length=50), default='Asia/Shanghai'),
        sa.Column('lastfm_api_key', sa.String(length=255), nullable=True),
        sa.Column('lastfm_username', sa.String(length=255), nullable=True),
        sa.Column('navidrome_url', sa.String(length=500), nullable=True),
        sa.Column('navidrome_username', sa.String(length=255), nullable=True),
        sa.Column('navidrome_password_encrypted', sa.String(length=255), nullable=True),
        sa.Column('webhook_url', sa.String(length=500), nullable=True),
        sa.Column('webhook_headers_json', sa.Text(), nullable=True),
        sa.Column('webhook_timeout_seconds', sa.Integer(), default=10),
        sa.Column('webhook_retry_count', sa.Integer(), default=3),
        sa.Column('playlist_keep_days', sa.Integer(), default=3),
        sa.Column('library_mode_default', sa.String(length=20), default='library_only'),
        sa.Column('duplicate_avoid_days', sa.Integer(), default=14),
        sa.Column('top_track_seed_limit', sa.Integer(), default=30),
        sa.Column('top_artist_seed_limit', sa.Integer(), default=30),
        sa.Column('similar_track_limit', sa.Integer(), default=30),
        sa.Column('similar_artist_limit', sa.Integer(), default=30),
        sa.Column('artist_top_track_limit', sa.Integer(), default=2),
        sa.Column('similar_playlist_size', sa.Integer(), default=30),
        sa.Column('artist_playlist_size', sa.Integer(), default=30),
        sa.Column('recommendation_balance', sa.Integer(), default=50),
        sa.Column('cron_enabled', sa.Boolean(), default=False),
        sa.Column('cron_expression', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'auth_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_table(
        'recommendation_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=30), default='pending'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('config_snapshot_json', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
    )

    op.create_table(
        'generated_playlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('playlist_type', sa.String(length=30), nullable=False),
        sa.Column('playlist_name', sa.String(length=255), nullable=False),
        sa.Column('playlist_date', sa.String(length=20), nullable=False),
        sa.Column('navidrome_playlist_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), default='pending'),
        sa.Column('total_candidates', sa.Integer(), default=0),
        sa.Column('matched_count', sa.Integer(), default=0),
        sa.Column('missing_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['recommendation_runs.id'], ondelete='CASCADE'),
    )

    op.create_table(
        'recommendation_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('generated_playlist_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('artist', sa.String(length=500), nullable=False),
        sa.Column('album', sa.String(length=500), nullable=True),
        sa.Column('score', sa.Numeric(10, 4), nullable=True),
        sa.Column('source_type', sa.String(length=30), nullable=False),
        sa.Column('source_seed_name', sa.String(length=500), nullable=True),
        sa.Column('source_seed_artist', sa.String(length=500), nullable=True),
        sa.Column('dedup_key', sa.String(length=500), nullable=True),
        sa.Column('rank_index', sa.Integer(), nullable=True),
        sa.Column('raw_payload_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['generated_playlist_id'], ['generated_playlists.id'], ondelete='CASCADE'),
        sa.Index('ix_recommendation_items_dedup_key', 'dedup_key'),
    )

    op.create_table(
        'navidrome_matches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recommendation_item_id', sa.Integer(), nullable=False),
        sa.Column('matched', sa.Boolean(), default=False),
        sa.Column('search_query', sa.String(length=500), nullable=True),
        sa.Column('selected_song_id', sa.String(length=100), nullable=True),
        sa.Column('selected_title', sa.String(length=500), nullable=True),
        sa.Column('selected_artist', sa.String(length=500), nullable=True),
        sa.Column('selected_album', sa.String(length=500), nullable=True),
        sa.Column('confidence_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('raw_response_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('recommendation_item_id'),
        sa.ForeignKeyConstraint(['recommendation_item_id'], ['recommendation_items.id'], ondelete='CASCADE'),
    )

    op.create_table(
        'webhook_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('playlist_type', sa.String(length=30), nullable=False),
        sa.Column('payload_json', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), default='pending'),
        sa.Column('response_code', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), default=0),
        sa.Column('max_retry_count', sa.Integer(), default=3),
        sa.Column('next_retry_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['recommendation_runs.id'], ondelete='CASCADE'),
    )

    op.create_table(
        'webhook_batch_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('track', sa.String(length=500), nullable=True),
        sa.Column('artist', sa.String(length=500), nullable=True),
        sa.Column('album', sa.String(length=500), nullable=True),
        sa.Column('text', sa.String(length=1000), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['batch_id'], ['webhook_batches.id'], ondelete='CASCADE'),
    )

    op.create_table(
        'lastfm_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cache_key', sa.String(length=255), nullable=False),
        sa.Column('cache_type', sa.String(length=50), nullable=False),
        sa.Column('payload_json', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cache_key'),
        sa.Index('ix_lastfm_cache_cache_key', 'cache_key'),
    )


def downgrade() -> None:
    op.drop_table('lastfm_cache')
    op.drop_table('webhook_batch_items')
    op.drop_table('webhook_batches')
    op.drop_table('navidrome_matches')
    op.drop_table('recommendation_items')
    op.drop_table('generated_playlists')
    op.drop_table('recommendation_runs')
    op.drop_table('auth_sessions')
    op.drop_table('system_settings')
    op.drop_table('users')