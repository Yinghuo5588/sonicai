"""Scheduled AI recommendation tasks."""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import AIRecommendationJob
from app.services.job_run_service import create_pending_run
from app.services.ai_recommend_service import run_ai_recommendation

logger = logging.getLogger(__name__)


async def run_ai_recommendation_cron_job(job_id: int):
    async with AsyncSessionLocal() as db:
        job = await db.get(AIRecommendationJob, job_id)

        if not job:
            logger.warning("[ai-cron] job not found id=%s", job_id)
            return

        if not job.enabled:
            logger.info("[ai-cron] job disabled id=%s", job_id)
            return

        owner_id = job.created_by_user_id

        try:
            run_id = await create_pending_run(
                run_type="ai",
                current_user_id=owner_id,
                trigger_type="scheduled",
                conflict_types=["ai"],
                lock_scope="ai",
                stale_after_minutes=10,
            )
        except HTTPException as e:
            if e.status_code == 409:
                logger.info("[ai-cron] skip job_id=%s: %s", job_id, e.detail)
                return
            raise

        logger.info("[ai-cron] dispatch job_id=%s run_id=%s", job_id, run_id)

        try:
            await run_ai_recommendation(
                run_id=run_id,
                prompt=job.prompt,
                mode=job.mode or "free",
                limit=int(job.limit or 30),
                playlist_name=job.playlist_name,
                match_threshold=float(job.match_threshold or 0.75),
                overwrite=bool(job.overwrite),
                trigger_type="scheduled",
                use_preference_profile=bool(job.use_preference_profile),
            )

            async with AsyncSessionLocal() as db:
                fresh = await db.get(AIRecommendationJob, job_id)
                if fresh:
                    fresh.last_run_at = datetime.now(timezone.utc)
                    fresh.last_error = None
                    await db.commit()

        except Exception as e:
            logger.exception("[ai-cron] failed job_id=%s", job_id)

            async with AsyncSessionLocal() as db:
                fresh = await db.get(AIRecommendationJob, job_id)
                if fresh:
                    fresh.last_run_at = datetime.now(timezone.utc)
                    fresh.last_error = str(e)[:2000]
                    await db.commit()

            raise