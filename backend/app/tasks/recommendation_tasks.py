"""Recommendation task — calls the recommendation service."""

import logging

logger = logging.getLogger(__name__)


async def run_recommendation_job(run_type: str = "full"):
    """Async entry for APScheduler — runs the recommendation service."""
    from app.services.recommendation_service import (
        run_full_recommendation,
        run_similar_tracks_only,
        run_similar_artists_only,
    )

    logger.info(f"[scheduler] dispatch recommendation job run_type={run_type}")

    if run_type == "full":
        await run_full_recommendation(trigger_type="scheduled")
    elif run_type == "similar_tracks":
        await run_similar_tracks_only(trigger_type="scheduled")
    elif run_type == "similar_artists":
        await run_similar_artists_only(trigger_type="scheduled")
    else:
        logger.warning(f"[scheduler] unknown run_type={run_type}")


def cleanup_old_playlists():
    """Cleanup task."""
    import asyncio
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
