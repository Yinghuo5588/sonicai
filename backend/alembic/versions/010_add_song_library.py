"""Add song library and matching cache tables

Revision ID: 010
Revises: 009
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "song_library",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("navidrome_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("artist", sa.String(length=500), nullable=True),
        sa.Column("album", sa.String(length=500), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("title_norm", sa.String(length=500), nullable=True),
        sa.Column("title_core", sa.String(length=500), nullable=True),
        sa.Column("artist_norm", sa.String(length=500), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=True, server_default="sync"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.UniqueConstraint("navidrome_id"),
    )
    op.create_index("ix_song_library_navidrome_id", "song_library", ["navidrome_id"])
    op.create_index("ix_song_library_title_norm", "song_library", ["title_norm"])
    op.create_index("ix_song_library_title_core", "song_library", ["title_core"])
    op.create_index("ix_song_library_artist_norm", "song_library", ["artist_norm"])

    op.create_table(
        "song_title_alias",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_id", sa.Integer(), nullable=False),
        sa.Column("alias", sa.String(length=500), nullable=False),
        sa.Column("alias_type", sa.String(length=30), nullable=True, server_default="auto"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["song_id"], ["song_library.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_song_title_alias_alias", "song_title_alias", ["alias"])
    op.create_index("ix_song_title_alias_song_id", "song_title_alias", ["song_id"])

    op.create_table(
        "song_artist_alias",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("song_id", sa.Integer(), nullable=False),
        sa.Column("alias", sa.String(length=500), nullable=False),
        sa.Column("alias_type", sa.String(length=30), nullable=True, server_default="auto"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["song_id"], ["song_library.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_song_artist_alias_alias", "song_artist_alias", ["alias"])
    op.create_index("ix_song_artist_alias_song_id", "song_artist_alias", ["song_id"])

    op.create_table(
        "match_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("input_title", sa.String(length=500), nullable=False),
        sa.Column("input_artist", sa.String(length=500), nullable=True),
        sa.Column("input_title_norm", sa.String(length=500), nullable=True),
        sa.Column("input_artist_norm", sa.String(length=500), nullable=True),
        sa.Column("song_id", sa.Integer(), nullable=True),
        sa.Column("navidrome_id", sa.String(length=100), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=True, server_default="auto"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["song_id"], ["song_library.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_match_cache_input_title_norm", "match_cache", ["input_title_norm"])
    op.create_index("ix_match_cache_input_artist_norm", "match_cache", ["input_artist_norm"])

    op.create_table(
        "manual_match",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("input_title", sa.String(length=500), nullable=False),
        sa.Column("input_artist", sa.String(length=500), nullable=True),
        sa.Column("input_title_norm", sa.String(length=500), nullable=True),
        sa.Column("input_artist_norm", sa.String(length=500), nullable=True),
        sa.Column("song_id", sa.Integer(), nullable=True),
        sa.Column("navidrome_id", sa.String(length=100), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["song_id"], ["song_library.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_manual_match_input_title_norm", "manual_match", ["input_title_norm"])
    op.create_index("ix_manual_match_input_artist_norm", "manual_match", ["input_artist_norm"])

    op.create_table(
        "match_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("input_title", sa.String(length=500), nullable=False),
        sa.Column("input_artist", sa.String(length=500), nullable=True),
        sa.Column("matched", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("navidrome_id", sa.String(length=100), nullable=True),
        sa.Column("selected_title", sa.String(length=500), nullable=True),
        sa.Column("selected_artist", sa.String(length=500), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=True),
        sa.Column("raw_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("match_log")
    op.drop_table("manual_match")
    op.drop_table("match_cache")
    op.drop_table("song_artist_alias")
    op.drop_table("song_title_alias")
    op.drop_table("song_library")