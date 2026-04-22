"""Recommendation task — calls the recommendation service."""

import logging

logger = logging.getLogger(__name__)


def run_recommendation_job(run_type: str = "full"):
    """Synchronous wrapper for the async recommendation service.
    APScheduler uses sync functions, so we use run_sync from asyncio."""
    import asyncio
    from app.services.recommendation_service import (
        run_full_recommendation,
        run_similar_tracks_only,
        run_similar_artists_only,
    )

    async def _dispatch():
        if run_type == "full":
            await run_full_recommendation()
        elif run_type == "similar_tracks":
            await run_similar_tracks_only()
        elif run_type == "similar_artists":
            await run_similar_artists_only()

    asyncio.run(_dispatch())


def cleanup_old_playlists():
    """Cleanup task."""
    import asyncio
    from datetime import datetime, timezone
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