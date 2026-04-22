"""Job execution routes."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import SystemSettings
from app.api.deps import CurrentUser

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/run-all")
async def run_all(current_user: CurrentUser, db=__import__("fastapi").Depends(__import__("app.db.session").get_db)):
    """Trigger full recommendation run (both playlists)."""
    from app.tasks.recommendation_tasks import run_recommendation_job
    # TODO: enqueue async job
    return {"message": "Job queued", "type": "full"}


@router.post("/run-similar-tracks")
async def run_similar_tracks(current_user: CurrentUser, db=__import__("fastapi").Depends(__import__("app.db.session").get_db)):
    return {"message": "Job queued", "type": "similar_tracks"}


@router.post("/run-similar-artists")
async def run_similar_artists(current_user: CurrentUser, db=__import__("fastapi").Depends(__import__("app.db.session").get_db)):
    return {"message": "Job queued", "type": "similar_artists"}


@router.get("")
async def list_jobs(current_user: CurrentUser, db=__import__("fastapi").Depends(__import__("app.db.session").get_db)):
    async with db as session:
        result = await session.execute(
            select(__import__("app.db.models").RecommendationRun)
            .order_by(__import__("app.db.models").RecommendationRun.created_at.desc())
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