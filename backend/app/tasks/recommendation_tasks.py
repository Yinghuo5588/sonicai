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
            current_user_id=None,
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
            current_user_id=None,
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
        match_threshold=float(settings.hotboard_match_threshold),
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
            current_user_id=None,
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
        match_threshold=float(settings.playlist_sync_threshold),
        playlist_name=settings.playlist_sync_name,
        overwrite=settings.playlist_sync_overwrite or False,
    )
