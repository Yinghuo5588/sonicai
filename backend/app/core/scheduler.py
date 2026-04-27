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
    from app.tasks.recommendation_tasks import run_recommendation_job, retry_pending_webhooks

    result = await db.execute(select(SystemSettings))
    config = result.scalar_one_or_none()

    sched = get_scheduler()

    # Remove existing job if any
    for job in sched.get_jobs():
        if job.id == "recommendation_cron":
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
                logger.info(f"Cron schedule loaded: {config.cron_expression}")
        except Exception as e:
            logger.warning(f"Invalid cron expression '{config.cron_expression}': {e}")

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