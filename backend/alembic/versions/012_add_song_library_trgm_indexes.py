"""Add trigram indexes for song library fuzzy search

Revision ID: 012
Revises: 011
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_song_library_title_norm_trgm "
        "ON song_library USING gin (title_norm gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_song_library_title_core_trgm "
        "ON song_library USING gin (title_core gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_song_library_artist_norm_trgm "
        "ON song_library USING gin (artist_norm gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_song_title_alias_alias_trgm "
        "ON song_title_alias USING gin (alias gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_song_artist_alias_alias_trgm "
        "ON song_artist_alias USING gin (alias gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_song_artist_alias_alias_trgm")
    op.execute("DROP INDEX IF EXISTS ix_song_title_alias_alias_trgm")
    op.execute("DROP INDEX IF EXISTS ix_song_library_artist_norm_trgm")
    op.execute("DROP INDEX IF EXISTS ix_song_library_title_core_trgm")
    op.execute("DROP INDEX IF EXISTS ix_song_library_title_norm_trgm")