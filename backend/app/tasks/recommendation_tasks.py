"""Recommendation task — placeholder for async job execution."""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def run_recommendation_job(run_type: str = "full"):
    """Main recommendation job - to be implemented."""
    logger.info(f"Running recommendation job: {run_type}")
    # TODO: implement full recommendation flow
    pass


async def cleanup_old_playlists():
    """Delete Navidrome playlists older than keep_days."""
    logger.info("Running playlist cleanup")
    # TODO: implement cleanup
    pass