"""Scheduled Navidrome favorite tracks sync task."""

import logging

from app.services.favorite_tracks_service import sync_navidrome_favorites_to_db

logger = logging.getLogger(__name__)


async def sync_favorite_tracks_cron_job():
    try:
        result = await sync_navidrome_favorites_to_db()
        logger.info("[favorite-tracks-cron] result=%s", result)
    except Exception:
        logger.exception("[favorite-tracks-cron] failed")