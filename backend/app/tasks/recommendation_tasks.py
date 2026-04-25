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
