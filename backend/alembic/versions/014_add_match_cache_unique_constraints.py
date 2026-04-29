"""Add unique constraints for match_cache and manual_match

Revision ID: 014
Revises: 013
Create Date: 2026-04-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_match_cache_input_norm",
        "match_cache",
        ["input_title_norm", "input_artist_norm"],
    )
    op.create_unique_constraint(
        "uq_manual_match_input_norm",
        "manual_match",
        ["input_title_norm", "input_artist_norm"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_manual_match_input_norm",
        "manual_match",
        type_="unique",
    )
    op.drop_constraint(
        "uq_match_cache_input_norm",
        "match_cache",
        type_="unique",
    )