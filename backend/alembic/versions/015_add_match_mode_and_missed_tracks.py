"""Add match mode and missed tracks

Revision ID: 015
Revises: 014
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SystemSettings: match_mode
    op.add_column(
        "system_settings",
        sa.Column(
            "match_mode",
            sa.String(length=20),
            nullable=True,
            server_default="full",
        ),
    )

    # SystemSettings: missed track retry settings
    op.add_column(
        "system_settings",
        sa.Column(
            "missed_track_retry_enabled",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "missed_track_retry_cron",
            sa.String(length=100),
            nullable=True,
            server_default="0 3 * * *",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "missed_track_retry_limit",
            sa.Integer(),
            nullable=True,
            server_default="100",
        ),
    )
    op.add_column(
        "system_settings",
        sa.Column(
            "missed_track_retry_refresh_library",
            sa.Boolean(),
            nullable=True,
            server_default=sa.true(),
        ),
    )

    # missed_tracks task pool
    op.create_table(
        "missed_tracks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("artist", sa.String(length=500), nullable=True),
        sa.Column("title_norm", sa.String(length=500), nullable=False),
        sa.Column("artist_norm", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("match_threshold", sa.Numeric(4, 3), nullable=True, server_default="0.75"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("seen_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("last_retry_at", sa.DateTime(), nullable=True),
        sa.Column("matched_at", sa.DateTime(), nullable=True),
        sa.Column("matched_navidrome_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "title_norm",
            "artist_norm",
            name="uq_missed_tracks_input_norm",
        ),
    )

    op.create_index("ix_missed_tracks_status", "missed_tracks", ["status"])
    op.create_index("ix_missed_tracks_title_norm", "missed_tracks", ["title_norm"])
    op.create_index("ix_missed_tracks_artist_norm", "missed_tracks", ["artist_norm"])


def downgrade() -> None:
    op.drop_index("ix_missed_tracks_artist_norm", table_name="missed_tracks")
    op.drop_index("ix_missed_tracks_title_norm", table_name="missed_tracks")
    op.drop_index("ix_missed_tracks_status", table_name="missed_tracks")
    op.drop_table("missed_tracks")

    op.drop_column("system_settings", "missed_track_retry_refresh_library")
    op.drop_column("system_settings", "missed_track_retry_limit")
    op.drop_column("system_settings", "missed_track_retry_cron")
    op.drop_column("system_settings", "missed_track_retry_enabled")
    op.drop_column("system_settings", "match_mode")