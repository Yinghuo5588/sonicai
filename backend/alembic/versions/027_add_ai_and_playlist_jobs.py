"""Add AI recommendation jobs and playlist sync jobs

Revision ID: 027
Revises: 026
Create Date: 2026-05-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_recommendation_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cron_expression", sa.String(length=100), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="free"),
        sa.Column("limit", sa.Integer(), nullable=True, server_default="30"),
        sa.Column("playlist_name", sa.String(length=255), nullable=True),
        sa.Column("match_threshold", sa.Numeric(4, 3), nullable=True, server_default="0.75"),
        sa.Column("overwrite", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("use_preference_profile", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_ai_recommendation_jobs_enabled",
        "ai_recommendation_jobs",
        ["enabled"],
    )

    op.create_table(
        "playlist_sync_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cron_expression", sa.String(length=100), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("match_threshold", sa.Numeric(4, 3), nullable=True, server_default="0.75"),
        sa.Column("playlist_name", sa.String(length=255), nullable=True),
        sa.Column("overwrite", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_hash", sa.String(length=64), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_playlist_sync_jobs_enabled",
        "playlist_sync_jobs",
        ["enabled"],
    )

    # 兼容旧配置：如果旧 system_settings 里已经有 playlist_sync_url，
    # 自动迁移成一条 playlist_sync_jobs 记录。
    op.execute("""
        INSERT INTO playlist_sync_jobs (
            name,
            enabled,
            cron_expression,
            url,
            match_threshold,
            playlist_name,
            overwrite,
            last_hash,
            created_by_user_id,
            created_at,
            updated_at
        )
        SELECT
            COALESCE(playlist_sync_name, '默认歌单同步'),
            COALESCE(playlist_sync_cron_enabled, false),
            COALESCE(playlist_sync_cron_expression, '0 5 * * *'),
            playlist_sync_url,
            COALESCE(playlist_sync_threshold, 0.75),
            playlist_sync_name,
            COALESCE(playlist_sync_overwrite, false),
            playlist_sync_last_hash,
            cron_created_by_user_id,
            now(),
            now()
        FROM system_settings
        WHERE playlist_sync_url IS NOT NULL
        AND playlist_sync_url <> ''
    """)


def downgrade() -> None:
    op.drop_index("ix_playlist_sync_jobs_enabled", table_name="playlist_sync_jobs")
    op.drop_table("playlist_sync_jobs")

    op.drop_index("ix_ai_recommendation_jobs_enabled", table_name="ai_recommendation_jobs")
    op.drop_table("ai_recommendation_jobs")