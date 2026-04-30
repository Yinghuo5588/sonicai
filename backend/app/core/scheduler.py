"""APScheduler wrapper for job management."""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone=settings.app_timezone)
    return _scheduler


async def load_cron_schedule(db: AsyncSession):
    """Load cron expression from DB and reschedule the recommendation job."""
    from app.db.models import SystemSettings
    from app.tasks.recommendation_tasks import (
        run_recommendation_job,
        retry_pending_webhooks,
        cleanup_expired_cache,
        run_hotboard_cron_job,
        run_playlist_sync_cron_job,
    )

    result = await db.execute(select(SystemSettings))
    config = result.scalar_one_or_none()

    sched = get_scheduler()

    # Remove existing cron jobs if any
    # APScheduler handles running jobs gracefully — removal waits for the
    # currently-executing instance to yield at an await point before removing
    for job in sched.get_jobs():
        if job.id in (
            "recommendation_cron",
            "hotboard_cron",
            "playlist_sync_cron",
            "song_cache_refresh",
            "missed_track_retry_cron",
        ):
            job.remove()

    if config and config.cron_enabled and config.cron_expression:
        try:
            parts = config.cron_expression.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone
                sched.add_job(
                    run_recommendation_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="recommendation_cron",
                    replace_existing=True,
                    misfire_grace_time=60,
                )
                logger.info(f"Recommendation cron loaded: {config.cron_expression}")
        except Exception as e:
            logger.warning(f"Invalid cron expression '{config.cron_expression}': {e}")

    # ===== Hotboard scheduled sync =====
    if config and config.hotboard_cron_enabled and config.hotboard_cron_expression:
        try:
            parts = config.hotboard_cron_expression.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone
                sched.add_job(
                    run_hotboard_cron_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="hotboard_cron",
                    replace_existing=True,
                    misfire_grace_time=120,
                )
                logger.info(f"Hotboard cron loaded: {config.hotboard_cron_expression}")
        except Exception as e:
            logger.warning(f"Invalid hotboard cron: {e}")

    # ===== Playlist URL scheduled sync =====
    if config and config.playlist_sync_cron_enabled and config.playlist_sync_cron_expression:
        try:
            parts = config.playlist_sync_cron_expression.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone
                sched.add_job(
                    run_playlist_sync_cron_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="playlist_sync_cron",
                    replace_existing=True,
                    misfire_grace_time=120,
                )
                logger.info("Playlist sync cron loaded: %s", config.playlist_sync_cron_expression)
        except Exception as e:
            logger.warning("Invalid playlist sync cron: %s", e)

    # ===== Song cache scheduled refresh =====
    if config and config.song_cache_auto_refresh_enabled and config.song_cache_refresh_cron:
        try:
            parts = config.song_cache_refresh_cron.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone

                async def _song_cache_refresh_job():
                    from app.services.song_cache import song_cache
                    await song_cache.refresh_full()

                sched.add_job(
                    _song_cache_refresh_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="song_cache_refresh",
                    replace_existing=True,
                    misfire_grace_time=300,
                )
                logger.info("Song cache cron loaded: %s", config.song_cache_refresh_cron)
        except Exception as e:
            logger.warning("Invalid song cache cron '%s': %s", config.song_cache_refresh_cron, e)

    # ===== Missed tracks scheduled retry =====
    if config and config.missed_track_retry_enabled and config.missed_track_retry_cron:
        try:
            from app.tasks.missed_track_tasks import retry_missed_tracks_job

            parts = config.missed_track_retry_cron.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone
                sched.add_job(
                    retry_missed_tracks_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="missed_track_retry_cron",
                    replace_existing=True,
                    misfire_grace_time=300,
                )
                logger.info("Missed track retry cron loaded: %s", config.missed_track_retry_cron)
        except Exception as e:
            logger.warning("Invalid missed track retry cron '%s': %s", config.missed_track_retry_cron, e)

    # Register webhook retry job (every 2 minutes)
    from apscheduler.triggers.interval import IntervalTrigger
    existing_retry_jobs = [j for j in sched.get_jobs() if j.id == "webhook_retry"]
    if not existing_retry_jobs:
        sched.add_job(
            retry_pending_webhooks,
            IntervalTrigger(minutes=2),
            id="webhook_retry",
            replace_existing=True,
            misfire_grace_time=30,
        )
        logger.info("Webhook retry job registered (every 2 min)")

    _register_cache_cleanup(sched)
    _register_match_log_cleanup(sched)


def start_scheduler():
    global _scheduler
    if not _scheduler or not _scheduler.running:
        _scheduler = get_scheduler()
        _scheduler.start()
        logger.info("Scheduler started")


def shutdown_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("Scheduler stopped")


def _register_cache_cleanup(sched):
    from app.tasks.recommendation_tasks import cleanup_expired_cache
    from apscheduler.triggers.interval import IntervalTrigger
    existing = [j for j in sched.get_jobs() if j.id == "cache_cleanup"]
    if not existing:
        sched.add_job(
            cleanup_expired_cache,
            IntervalTrigger(hours=6),
            id="cache_cleanup",
            replace_existing=True,
            misfire_grace_time=60,
        )
        logger.info("Cache cleanup job registered (every 6 hours)")


def _register_match_log_cleanup(sched):
    from app.tasks.recommendation_tasks import cleanup_old_match_logs
    from apscheduler.triggers.interval import IntervalTrigger

    existing = [j for j in sched.get_jobs() if j.id == "match_log_cleanup"]
    if not existing:
        sched.add_job(
            cleanup_old_match_logs,
            IntervalTrigger(hours=24),
            id="match_log_cleanup",
            replace_existing=True,
            misfire_grace_time=300,
        )
        logger.info("Match log cleanup job registered (every 24 hours)")
