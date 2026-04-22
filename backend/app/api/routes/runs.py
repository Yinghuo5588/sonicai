"""Runs and playlists routes."""

from fastapi import APIRouter
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import CurrentUser

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("")
async def list_runs(current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        result = await session.execute(
            select(__import__("app.db.models").RecommendationRun)
            .order_by(__import__("app.db.models").RecommendationRun.created_at.desc())
            .limit(50)
        )
        runs = result.scalars().all()
        return [
            {
                "id": r.id,
                "run_type": r.run_type,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ]


@router.get("/{run_id}")
async def get_run(run_id: int, current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        result = await session.execute(
            select(__import__("app.db.models").RecommendationRun).where(__import__("app.db.models").RecommendationRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if not run:
            return {"error": "Not found"}
        return {
            "id": run.id,
            "run_type": run.run_type,
            "status": run.status,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "error_message": run.error_message,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        }


@router.get("/{run_id}/playlists")
async def get_run_playlists(run_id: int, current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        result = await session.execute(
            select(__import__("app.db.models").GeneratedPlaylist)
            .where(__import__("app.db.models").GeneratedPlaylist.run_id == run_id)
        )
        playlists = result.scalars().all()
        return [
            {
                "id": p.id,
                "playlist_type": p.playlist_type,
                "playlist_name": p.playlist_name,
                "status": p.status,
                "matched_count": p.matched_count,
                "missing_count": p.missing_count,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in playlists
        ]