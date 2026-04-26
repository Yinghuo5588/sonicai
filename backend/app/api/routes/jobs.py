"""Job execution routes."""

import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.db.models import SystemSettings, RecommendationRun
from app.api.deps import CurrentUser
from app.services.recommendation_service import (
    run_full_recommendation,
    run_similar_tracks_only,
    run_similar_artists_only,
    stop_run,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


async def _has_conflicting_job(db: AsyncSession, run_types: list[str]) -> bool:
    """Return True if there's a pending or running job of any of the given run_types."""
    result = await db.execute(
        select(RecommendationRun.id).where(
            and_(
                RecommendationRun.status.in_(["pending", "running"]),
                RecommendationRun.run_type.in_(run_types),
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _create_pending_run(
    db: AsyncSession,
    run_type: str,
    current_user_id: int | None,
    trigger_type: str = "manual",
) -> int:
    """Create a pending run in DB first, then hand off to async task (avoids race)."""
    run = RecommendationRun(
        run_type=run_type,
        trigger_type=trigger_type,
        status="pending",
        started_at=None,
        finished_at=None,
        created_by_user_id=current_user_id,
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()
    return run_id


@router.post("/run-all")
async def run_all(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    import asyncio

    if await _has_conflicting_job(db, ["full", "similar_tracks", "similar_artists"]):
        raise HTTPException(status_code=409, detail="Another recommendation job is already running")

    logger.info(f"[jobs] queue run_type=full user_id={current_user.id}")
    run_id = await _create_pending_run(db, "full", current_user.id, trigger_type="manual")
    logger.info(f"[jobs] queued run_type=full run_id={run_id} user_id={current_user.id}")
    asyncio.create_task(run_full_recommendation(run_id=run_id, trigger_type="manual"))
    return {"message": "Job queued", "type": "full", "run_id": run_id}


@router.post("/run-similar-tracks")
async def run_similar_tracks(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    import asyncio

    if await _has_conflicting_job(db, ["full", "similar_tracks"]):
        raise HTTPException(status_code=409, detail="A similar-tracks related job is already running")

    logger.info(f"[jobs] queue run_type=similar_tracks user_id={current_user.id}")
    run_id = await _create_pending_run(db, "similar_tracks", current_user.id, trigger_type="manual")
    logger.info(f"[jobs] queued run_type=similar_tracks run_id={run_id} user_id={current_user.id}")
    asyncio.create_task(run_similar_tracks_only(run_id=run_id, trigger_type="manual"))
    return {"message": "Job queued", "type": "similar_tracks", "run_id": run_id}


@router.post("/run-similar-artists")
async def run_similar_artists(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    import asyncio

    if await _has_conflicting_job(db, ["full", "similar_artists"]):
        raise HTTPException(status_code=409, detail="A similar-artists related job is already running")

    logger.info(f"[jobs] queue run_type=similar_artists user_id={current_user.id}")
    run_id = await _create_pending_run(db, "similar_artists", current_user.id, trigger_type="manual")
    logger.info(f"[jobs] queued run_type=similar_artists run_id={run_id} user_id={current_user.id}")
    asyncio.create_task(run_similar_artists_only(run_id=run_id, trigger_type="manual"))
    return {"message": "Job queued", "type": "similar_artists", "run_id": run_id}


@router.post("/{job_id}/stop")
async def stop_job(job_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
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
