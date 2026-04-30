"""Job execution routes."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from app.core.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import SystemSettings, RecommendationRun
from app.api.deps import CurrentUser
from app.core.task_registry import create_background_task
from app.services.job_run_service import create_pending_run
from app.services.recommendation_service import (
    run_full_recommendation,
    run_similar_tracks_only,
    run_similar_artists_only,
    stop_run,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/run-all")
@limiter.limit("3/minute")
async def run_all(request: Request, current_user: CurrentUser):
    logger.info(f"[jobs] queue run_type=full user_id={current_user.id}")
    run_id = await create_pending_run(
        run_type="full",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["full", "similar_tracks", "similar_artists"],
        lock_scope="recommendation",
    )
    logger.info(f"[jobs] queued run_type=full run_id={run_id} user_id={current_user.id}")
    create_background_task(
        run_full_recommendation(run_id=run_id, trigger_type="manual"),
        name=f"full-recommendation-{run_id}",
    )
    return {"message": "Job queued", "type": "full", "run_id": run_id}


@router.post("/run-similar-tracks")
@limiter.limit("3/minute")
async def run_similar_tracks(request: Request, current_user: CurrentUser):
    logger.info(f"[jobs] queue run_type=similar_tracks user_id={current_user.id}")
    run_id = await create_pending_run(
        run_type="similar_tracks",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["full", "similar_tracks"],
        lock_scope="recommendation",
    )
    logger.info(f"[jobs] queued run_type=similar_tracks run_id={run_id} user_id={current_user.id}")
    create_background_task(
        run_similar_tracks_only(run_id=run_id, trigger_type="manual"),
        name=f"similar-tracks-{run_id}",
    )
    return {"message": "Job queued", "type": "similar_tracks", "run_id": run_id}


@router.post("/run-similar-artists")
@limiter.limit("3/minute")
async def run_similar_artists(request: Request, current_user: CurrentUser):
    logger.info(f"[jobs] queue run_type=similar_artists user_id={current_user.id}")
    run_id = await create_pending_run(
        run_type="similar_artists",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["full", "similar_artists"],
        lock_scope="recommendation",
    )
    logger.info(f"[jobs] queued run_type=similar_artists run_id={run_id} user_id={current_user.id}")
    create_background_task(
        run_similar_artists_only(run_id=run_id, trigger_type="manual"),
        name=f"similar-artists-{run_id}",
    )
    return {"message": "Job queued", "type": "similar_artists", "run_id": run_id}


@router.post("/{job_id}/stop")
@limiter.limit("20/minute")
async def stop_job(
    request: Request,
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Force-stop a running or pending job."""
    result = await db.execute(
        select(RecommendationRun).where(RecommendationRun.id == job_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Job not found")
    if run.status not in ["pending", "running"]:
        raise HTTPException(status_code=400, detail=f"Job is {run.status}, cannot stop")

    stopped = stop_run(job_id)
    run.status = "stopped"
    run.finished_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info(f"[jobs] stopped job_id={job_id} signaled={stopped}")
    return {"message": "Job stopped", "job_id": job_id}


@router.get("")
async def list_jobs(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecommendationRun)
        .order_by(RecommendationRun.created_at.desc())
        .limit(20)
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "run_type": r.run_type,
            "trigger_type": r.trigger_type,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/{job_id}")
async def get_job(job_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecommendationRun).where(RecommendationRun.id == job_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": run.id,
        "run_type": run.run_type,
        "trigger_type": run.trigger_type,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
