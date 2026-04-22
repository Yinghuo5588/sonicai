"""Job execution routes."""

import logging
from fastapi import APIRouter, HTTPException, Depends

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun
from app.api.deps import CurrentUser
from app.services.recommendation_service import (
    run_full_recommendation,
    run_similar_tracks_only,
    run_similar_artists_only,
)
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/run-all")
async def run_all(current_user: CurrentUser):
    import asyncio
    asyncio.create_task(run_full_recommendation())
    return {"message": "Job queued", "type": "full"}


@router.post("/run-similar-tracks")
async def run_similar_tracks(current_user: CurrentUser):
    import asyncio
    asyncio.create_task(run_similar_tracks_only())
    return {"message": "Job queued", "type": "similar_tracks"}


@router.post("/run-similar-artists")
async def run_similar_artists(current_user: CurrentUser):
    import asyncio
    asyncio.create_task(run_similar_artists_only())
    return {"message": "Job queued", "type": "similar_artists"}


@router.get("")
async def list_jobs(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
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
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/{job_id}")
async def get_job(job_id: int, current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    result = await db.execute(
        select(RecommendationRun).where(RecommendationRun.id == job_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": run.id,
        "run_type": run.run_type,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }