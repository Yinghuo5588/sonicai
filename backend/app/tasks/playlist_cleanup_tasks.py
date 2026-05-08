"""Playlist cleanup scheduled tasks."""

import logging

from app.services.playlist_cleanup_service import run_playlist_cleanup

logger = logging.getLogger(__name__)


async def run_playlist_cleanup_cron_job():
    """Cron-triggered playlist cleanup."""
    try:
        result = await run_playlist_cleanup(force=False)
        logger.info("[playlist-cleanup-cron] result=%s", result)
    except Exception:
        logger.exception("[playlist-cleanup-cron] failed")