"""Scheduled playlist sync jobs."""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.session import AsyncSessionLocal
from app.db.models import PlaylistSyncJob
from app.services.job_run_service import create_pending_run
from app.services.playlist_incremental import run_incremental_playlist_sync

logger = logging.getLogger(__name__)


async def run_playlist_sync_job(job_id: int):
    async with AsyncSessionLocal() as db:
        job = await db.get(PlaylistSyncJob, job_id)

        if not job:
            logger.warning("[playlist-sync-job] job not found id=%s", job_id)
            return

        if not job.enabled:
            logger.info("[playlist-sync-job] job disabled id=%s", job_id)
            return

        if not job.url:
            logger.warning("[playlist-sync-job] job id=%s has empty url", job_id)
            return

        owner_id = job.created_by_user_id

        try:
            run_id = await create_pending_run(
                run_type="playlist",
                current_user_id=owner_id,
                trigger_type="scheduled",
                conflict_types=["playlist"],
                lock_scope="playlist",
                stale_after_minutes=10,
            )
        except HTTPException as e:
            if e.status_code == 409:
                logger.info("[playlist-sync-job] skip job_id=%s: %s", job_id, e.detail)
                return
            raise

        logger.info("[playlist-sync-job] dispatch job_id=%s run_id=%s", job_id, run_id)

        try:
            await run_incremental_playlist_sync(
                run_id=run_id,
                url=job.url,
                match_threshold=float(job.match_threshold or 0.75),
                playlist_name=job.playlist_name,
                overwrite=bool(job.overwrite),
                playlist_sync_job_id=job_id,
            )

            async with AsyncSessionLocal() as db:
                fresh = await db.get(PlaylistSyncJob, job_id)
                if fresh:
                    fresh.last_run_at = datetime.now(timezone.utc)
                    fresh.last_error = None
                    await db.commit()

        except Exception as e:
            logger.exception("[playlist-sync-job] failed job_id=%s", job_id)

            async with AsyncSessionLocal() as db:
                fresh = await db.get(PlaylistSyncJob, job_id)
                if fresh:
                    fresh.last_run_at = datetime.now(timezone.utc)
                    fresh.last_error = str(e)[:2000]
                    await db.commit()

            raise