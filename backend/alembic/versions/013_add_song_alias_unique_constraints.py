"""Add unique constraints for song aliases

Revision ID: 013
Revises: 012
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_song_title_alias_song_alias",
        "song_title_alias",
        ["song_id", "alias"],
    )
    op.create_unique_constraint(
        "uq_song_artist_alias_song_alias",
        "song_artist_alias",
        ["song_id", "alias"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_song_artist_alias_song_alias",
        "song_artist_alias",
        type_="unique",
    )
    op.drop_constraint(
        "uq_song_title_alias_song_alias",
        "song_title_alias",
        type_="unique",
    )