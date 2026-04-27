"""Recommendation task — calls the recommendation service."""

import logging
import asyncio

logger = logging.getLogger(__name__)


async def run_recommendation_job(run_type: str = "full"):
    """Async entry for APScheduler — creates pending run first, then executes (avoids race)."""
    from datetime import datetime, timezone
    from app.db.session import AsyncSessionLocal
    from app.db.models import RecommendationRun

    async with AsyncSessionLocal() as db:
        run = RecommendationRun(
            run_type=run_type,
            trigger_type="scheduled",
            status="pending",
            started_at=None,
            finished_at=None,
            created_by_user_id=None,
        )
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()

    from app.services.recommendation_service import (
        run_full_recommendation,
        run_similar_tracks_only,
        run_similar_artists_only,
    )

    logger.info(f"[scheduler] dispatch recommendation job run_type={run_type} run_id={run_id}")

    if run_type == "full":
        await run_full_recommendation(run_id=run_id, trigger_type="scheduled")
    elif run_type == "similar_tracks":
        await run_similar_tracks_only(run_id=run_id, trigger_type="scheduled")
    elif run_type == "similar_artists":
        await run_similar_artists_only(run_id=run_id, trigger_type="scheduled")
    else:
        logger.warning(f"[scheduler] unknown run_type={run_type} run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = f"Unknown scheduled run_type: {run_type}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()


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


def cleanup_old_playlists():
    """Cleanup task (synchronous APScheduler entry)."""
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings

    async def _do():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()
        if not settings:
            return
        from app.services.recommendation_service import _cleanup_old_playlists
        await _cleanup_old_playlists(settings)

    asyncio.run(_do())
