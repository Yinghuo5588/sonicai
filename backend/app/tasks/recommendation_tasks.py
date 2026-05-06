"""Recommendation task — calls the recommendation service."""

import logging

logger = logging.getLogger(__name__)


async def run_recommendation_job(run_type: str = "full"):
    """Async entry for APScheduler — creates pending run first, then executes."""
    from fastapi import HTTPException
    from app.services.job_run_service import create_pending_run
    from app.services.recommendation_service import (
        run_full_recommendation,
        run_similar_tracks_only,
        run_similar_artists_only,
    )

    if run_type == "full":
        conflict_types = ["full", "similar_tracks", "similar_artists"]
    elif run_type == "similar_tracks":
        conflict_types = ["full", "similar_tracks"]
    elif run_type == "similar_artists":
        conflict_types = ["full", "similar_artists"]
    else:
        logger.warning(f"[scheduler] unknown run_type={run_type}")
        return

    try:
        run_id = await create_pending_run(
            run_type=run_type,
            current_user_id=settings.cron_created_by_user_id,
            trigger_type="scheduled",
            conflict_types=conflict_types,
            lock_scope="recommendation",
        )
    except HTTPException as e:
        if e.status_code == 409:
            logger.info(f"[scheduler] skip recommendation job run_type={run_type}: {e.detail}")
            return
        raise

    logger.info(f"[scheduler] dispatch recommendation job run_type={run_type} run_id={run_id}")

    if run_type == "full":
        await run_full_recommendation(run_id=run_id, trigger_type="scheduled")
    elif run_type == "similar_tracks":
        await run_similar_tracks_only(run_id=run_id, trigger_type="scheduled")
    elif run_type == "similar_artists":
        await run_similar_artists_only(run_id=run_id, trigger_type="scheduled")


async def retry_pending_webhooks():
    """Scan webhook batches that are due for retry and resend them."""
    from datetime import datetime, timezone
    from sqlalchemy import select, and_
    from app.db.session import AsyncSessionLocal
    from app.db.models import WebhookBatch
    from app.services.webhook_service import send_webhook_batch

    logger.info("[webhook-retry] scanning for pending retries")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WebhookBatch).where(
                and_(
                    WebhookBatch.status == "retrying",
                    WebhookBatch.next_retry_at <= datetime.now(timezone.utc),
                )
            )
        )
        batches = result.scalars().all()

        if not batches:
            logger.info("[webhook-retry] no pending retries found")
            return

        logger.info(f"[webhook-retry] found {len(batches)} batches to retry")
        for batch in batches:
            try:
                await send_webhook_batch(batch.id)
                logger.info(f"[webhook-retry] retried batch_id={batch.id}")
            except Exception as e:
                logger.warning(f"[webhook-retry] failed batch_id={batch.id}: {e}")


async def cleanup_expired_cache():
    """Clean up expired Last.fm cache entries."""
    from datetime import datetime, timezone
    from sqlalchemy import delete
    from app.db.session import AsyncSessionLocal
    from app.db.models import LastfmCache

    logger.info("[cache-cleanup] scanning for expired entries")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(LastfmCache).where(LastfmCache.expires_at < datetime.now(timezone.utc))
        )
        deleted = result.rowcount
        await db.commit()
        logger.info(f"[cache-cleanup] deleted {deleted} expired cache entries")


async def run_hotboard_cron_job():
    """Cron-triggered hotboard sync task."""
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings
    from app.services.job_run_service import create_pending_run
    from app.services.hotboard_recommend import run_hotboard_sync

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
        if not settings or not settings.hotboard_cron_enabled:
            return

    try:
        run_id = await create_pending_run(
            run_type="hotboard",
            current_user_id=settings.cron_created_by_user_id,
            trigger_type="scheduled",
            conflict_types=["hotboard"],
            lock_scope="hotboard",
            stale_after_minutes=10,
        )
    except HTTPException as e:
        if e.status_code == 409:
            logger.info(f"[scheduler] skip hotboard sync: {e.detail}")
            return
        raise

    logger.info(f"[scheduler] dispatch hotboard sync run_id={run_id}")

    await run_hotboard_sync(
        run_id=run_id,
        limit=settings.hotboard_limit or 50,
        match_threshold=float(settings.hotboard_match_threshold or 0.75),
        playlist_name=settings.hotboard_playlist_name,
        overwrite=settings.hotboard_overwrite if settings.hotboard_overwrite is not None else True,
        trigger_type="scheduled",
    )


async def cleanup_old_match_logs():
    """Clean up match_log entries older than 30 days."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import delete
    from app.db.session import AsyncSessionLocal
    from app.db.models import MatchLog

    logger.info("[match-log-cleanup] scanning old match logs")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(MatchLog).where(MatchLog.created_at < cutoff)
        )
        deleted = result.rowcount
        await db.commit()
        logger.info("[match-log-cleanup] deleted %s old logs", deleted)


async def run_playlist_sync_cron_job():
    """Cron-triggered playlist incremental sync task."""
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings
    from app.services.job_run_service import create_pending_run
    from app.services.playlist_incremental import run_incremental_playlist_sync

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
        if not settings or not settings.playlist_sync_cron_enabled:
            return
        if not settings.playlist_sync_url:
            logger.warning("[scheduler] playlist_sync_cron enabled but no URL configured, skipping")
            return

    try:
        run_id = await create_pending_run(
            run_type="playlist",
            current_user_id=settings.cron_created_by_user_id,
            trigger_type="scheduled",
            conflict_types=["playlist"],
            lock_scope="playlist",
            stale_after_minutes=10,
        )
    except HTTPException as e:
        if e.status_code == 409:
            logger.info(f"[scheduler] skip playlist sync: {e.detail}")
            return
        raise

    logger.info(f"[scheduler] dispatch playlist sync run_id={run_id}")

    await run_incremental_playlist_sync(
        run_id=run_id,
        url=settings.playlist_sync_url,
        match_threshold=float(settings.playlist_sync_threshold or 0.75),
        playlist_name=settings.playlist_sync_name,
        overwrite=settings.playlist_sync_overwrite or False,
    )


async def cleanup_old_history():
    """Clean up old recommendation runs and webhook batches based on retention settings.

    This only deletes SonicAI internal database records — it never deletes
    Navidrome playlists, even if the cleanup setting is enabled.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, and_
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings, RecommendationRun, WebhookBatch

    logger.info("[history-cleanup] scanning old history")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

        if not settings or not getattr(settings, "history_cleanup_enabled", False):
            logger.info("[history-cleanup] disabled")
            return

        run_days = int(getattr(settings, "run_history_keep_days", 90) or 90)
        webhook_days = int(getattr(settings, "webhook_history_keep_days", 30) or 30)
        keep_failed = bool(getattr(settings, "keep_failed_history", True))

        now = datetime.now(timezone.utc)
        run_cutoff = now - timedelta(days=run_days)
        webhook_cutoff = now - timedelta(days=webhook_days)

        # 1. Clean up old recommendation runs
        run_conditions = [
            RecommendationRun.created_at < run_cutoff,
            RecommendationRun.status.notin_(["pending", "running"]),
        ]

        if keep_failed:
            run_conditions.append(
                RecommendationRun.status.in_(["success", "completed", "partial_success"])
            )

        old_runs_result = await db.execute(
            select(RecommendationRun).where(and_(*run_conditions))
        )
        old_runs = old_runs_result.scalars().all()

        deleted_runs = 0
        for run in old_runs:
            await db.delete(run)
            deleted_runs += 1

        # 2. Clean up old webhook batches
        webhook_conditions = [
            WebhookBatch.created_at < webhook_cutoff,
        ]

        if keep_failed:
            webhook_conditions.append(WebhookBatch.status == "success")
        else:
            webhook_conditions.append(WebhookBatch.status.notin_(["pending", "retrying"]))

        old_webhooks_result = await db.execute(
            select(WebhookBatch).where(and_(*webhook_conditions))
        )
        old_webhooks = old_webhooks_result.scalars().all()

        deleted_webhooks = 0
        for batch in old_webhooks:
            await db.delete(batch)
            deleted_webhooks += 1

        await db.commit()

        logger.info(
            "[history-cleanup] deleted runs=%s webhooks=%s",
            deleted_runs,
            deleted_webhooks,
        )
