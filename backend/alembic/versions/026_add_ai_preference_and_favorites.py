"""Add AI preference profile and Navidrome favorite tracks

Revision ID: 026
Revises: 025
Create Date: 2026-05-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AI preference profile
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_preference_profile_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column("ai_preference_profile_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "system_settings",
        sa.Column("ai_preference_profile_filename", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "system_settings",
        sa.Column("ai_preference_profile_updated_at", sa.DateTime(), nullable=True),
    )

    # AI favorites personalization
    op.add_column(
        "system_settings",
        sa.Column(
            "ai_favorites_sample_limit",
            sa.Integer(),
            nullable=True,
            server_default=sa.text("40"),
        ),
    )

    # Navidrome favorite tracks sync
    op.add_column(
        "system_settings",
        sa.Column(
            "favorite_tracks_sync_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "favorite_tracks_sync_cron",
            sa.String(length=100),
            nullable=True,
            server_default=sa.text("'15 4 * * *'"),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column("favorite_tracks_last_sync_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "system_settings",
        sa.Column("favorite_tracks_last_error", sa.Text(), nullable=True),
    )

    op.create_table(
        "navidrome_favorite_tracks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("navidrome_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("artist", sa.String(length=500), nullable=True),
        sa.Column("album", sa.String(length=500), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("title_norm", sa.String(length=500), nullable=True),
        sa.Column("artist_norm", sa.String(length=500), nullable=True),
        sa.Column("dedup_key", sa.String(length=500), nullable=True),
        sa.Column("starred_at", sa.DateTime(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("navidrome_id", name="uq_navidrome_favorite_tracks_navidrome_id"),
    )

    op.create_index(
        "ix_navidrome_favorite_tracks_navidrome_id",
        "navidrome_favorite_tracks",
        ["navidrome_id"],
    )
    op.create_index(
        "ix_navidrome_favorite_tracks_dedup_key",
        "navidrome_favorite_tracks",
        ["dedup_key"],
    )
    op.create_index(
        "ix_navidrome_favorite_tracks_title_norm",
        "navidrome_favorite_tracks",
        ["title_norm"],
    )
    op.create_index(
        "ix_navidrome_favorite_tracks_artist_norm",
        "navidrome_favorite_tracks",
        ["artist_norm"],
    )


def downgrade() -> None:
    op.drop_index("ix_navidrome_favorite_tracks_artist_norm", table_name="navidrome_favorite_tracks")
    op.drop_index("ix_navidrome_favorite_tracks_title_norm", table_name="navidrome_favorite_tracks")
    op.drop_index("ix_navidrome_favorite_tracks_dedup_key", table_name="navidrome_favorite_tracks")
    op.drop_index("ix_navidrome_favorite_tracks_navidrome_id", table_name="navidrome_favorite_tracks")
    op.drop_table("navidrome_favorite_tracks")

    op.drop_column("system_settings", "favorite_tracks_last_error")
    op.drop_column("system_settings", "favorite_tracks_last_sync_at")
    op.drop_column("system_settings", "favorite_tracks_sync_cron")
    op.drop_column("system_settings", "favorite_tracks_sync_enabled")
    op.drop_column("system_settings", "ai_favorites_sample_limit")
    op.drop_column("system_settings", "ai_preference_profile_updated_at")
    op.drop_column("system_settings", "ai_preference_profile_filename")
    op.drop_column("system_settings", "ai_preference_profile_text")
    op.drop_column("system_settings", "ai_preference_profile_enabled")