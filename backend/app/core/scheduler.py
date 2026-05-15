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
        if (
            job.id
            in (
                "recommendation_cron",
                "hotboard_cron",
                "playlist_sync_cron",
                "song_cache_refresh",
                "missed_track_retry_cron",
                "playlist_cleanup_cron",
                "favorite_tracks_sync_cron",
                "history_cleanup",
            )
            or job.id.startswith("ai_recommendation_job_")
            or job.id.startswith("playlist_sync_job_")
        ):
            job.remove()

    if config and config.cron_enabled and config.cron_expression:
        try:
            parts = config.cron_expression.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone

                run_type = getattr(config, "recommendation_cron_run_type", None) or "full"
                if run_type not in {"full", "similar_tracks", "similar_artists"}:
                    logger.warning(
                        "Invalid recommendation_cron_run_type '%s', fallback to full",
                        run_type,
                    )
                    run_type = "full"

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
                    kwargs={"run_type": run_type},
                )
                logger.info(
                    "Recommendation cron loaded: %s, run_type=%s",
                    config.cron_expression,
                    run_type,
                )
        except Exception as e:
            logger.warning("Invalid cron expression '%s': %s", config.cron_expression, e)

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

    # ===== AI recommendation scheduled jobs =====
    try:
        from app.db.models import AIRecommendationJob
        from app.tasks.ai_tasks import run_ai_recommendation_cron_job

        result = await db.execute(
            select(AIRecommendationJob).where(AIRecommendationJob.enabled == True)
        )
        ai_jobs = result.scalars().all()

        for ai_job in ai_jobs:
            parts = str(ai_job.cron_expression or "").split()
            if len(parts) < 5:
                logger.warning(
                    "Invalid AI recommendation cron job id=%s expr=%s",
                    ai_job.id,
                    ai_job.cron_expression,
                )
                continue

            tz = config.timezone if config and config.timezone else settings.app_timezone

            sched.add_job(
                run_ai_recommendation_cron_job,
                CronTrigger(
                    minute=parts[0],
                    hour=parts[1],
                    day=parts[2],
                    month=parts[3],
                    day_of_week=parts[4],
                    timezone=tz,
                ),
                id=f"ai_recommendation_job_{ai_job.id}",
                replace_existing=True,
                misfire_grace_time=300,
                kwargs={"job_id": ai_job.id},
            )

            logger.info(
                "AI recommendation cron loaded: id=%s name=%s expr=%s",
                ai_job.id,
                ai_job.name,
                ai_job.cron_expression,
            )

    except Exception as e:
        logger.warning("Failed to load AI recommendation cron jobs: %s", e)

    # ===== Multiple playlist sync scheduled jobs =====
    try:
        from app.db.models import PlaylistSyncJob
        from app.tasks.playlist_sync_tasks import run_playlist_sync_job

        result = await db.execute(
            select(PlaylistSyncJob).where(PlaylistSyncJob.enabled == True)
        )
        playlist_jobs = result.scalars().all()

        for playlist_job in playlist_jobs:
            parts = str(playlist_job.cron_expression or "").split()
            if len(parts) < 5:
                logger.warning(
                    "Invalid playlist sync cron job id=%s expr=%s",
                    playlist_job.id,
                    playlist_job.cron_expression,
                )
                continue

            tz = config.timezone if config and config.timezone else settings.app_timezone

            sched.add_job(
                run_playlist_sync_job,
                CronTrigger(
                    minute=parts[0],
                    hour=parts[1],
                    day=parts[2],
                    month=parts[3],
                    day_of_week=parts[4],
                    timezone=tz,
                ),
                id=f"playlist_sync_job_{playlist_job.id}",
                replace_existing=True,
                misfire_grace_time=300,
                kwargs={"job_id": playlist_job.id},
            )

            logger.info(
                "Playlist sync cron loaded: id=%s name=%s expr=%s",
                playlist_job.id,
                playlist_job.name,
                playlist_job.cron_expression,
            )

    except Exception as e:
        logger.warning("Failed to load playlist sync cron jobs: %s", e)

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

    # ===== Playlist lifecycle scheduled cleanup =====
    if config and getattr(config, "playlist_cleanup_enabled", False) and getattr(config, "playlist_cleanup_cron", None):
        try:
            from app.tasks.playlist_cleanup_tasks import run_playlist_cleanup_cron_job

            parts = config.playlist_cleanup_cron.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone

                sched.add_job(
                    run_playlist_cleanup_cron_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="playlist_cleanup_cron",
                    replace_existing=True,
                    misfire_grace_time=300,
                )
                logger.info("Playlist cleanup cron loaded: %s", config.playlist_cleanup_cron)
        except Exception as e:
            logger.warning(
                "Invalid playlist cleanup cron '%s': %s",
                getattr(config, "playlist_cleanup_cron", None),
                e,
            )

    # ===== Navidrome favorite tracks scheduled sync =====
    if config and getattr(config, "favorite_tracks_sync_enabled", True) and getattr(config, "favorite_tracks_sync_cron", None):
        try:
            from app.tasks.favorite_tracks_tasks import sync_favorite_tracks_cron_job

            parts = config.favorite_tracks_sync_cron.split()
            if len(parts) >= 5:
                tz = config.timezone if config and config.timezone else settings.app_timezone

                sched.add_job(
                    sync_favorite_tracks_cron_job,
                    CronTrigger(
                        minute=parts[0],
                        hour=parts[1],
                        day=parts[2],
                        month=parts[3],
                        day_of_week=parts[4],
                        timezone=tz,
                    ),
                    id="favorite_tracks_sync_cron",
                    replace_existing=True,
                    misfire_grace_time=300,
                )
                logger.info("Favorite tracks sync cron loaded: %s", config.favorite_tracks_sync_cron)
        except Exception as e:
            logger.warning(
                "Invalid favorite tracks sync cron '%s': %s",
                getattr(config, "favorite_tracks_sync_cron", None),
                e,
            )

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
    _register_history_cleanup(sched)


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


def _register_history_cleanup(sched):
    from app.tasks.recommendation_tasks import cleanup_old_history
    from apscheduler.triggers.interval import IntervalTrigger

    existing = [j for j in sched.get_jobs() if j.id == "history_cleanup"]
    if not existing:
        sched.add_job(
            cleanup_old_history,
            IntervalTrigger(hours=24),
            id="history_cleanup",
            replace_existing=True,
            misfire_grace_time=300,
        )
        logger.info("History cleanup job registered (every 24 hours)")
