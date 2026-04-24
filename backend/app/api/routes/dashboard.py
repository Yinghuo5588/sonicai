"""Dashboard summary routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import RecommendationRun, GeneratedPlaylist, WebhookBatch
from app.api.deps import CurrentUser

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    total_runs = await db.execute(select(func.count(RecommendationRun.id)))
    total_runs = total_runs.scalar() or 0

    last_run_result = await db.execute(
        select(RecommendationRun).order_by(RecommendationRun.created_at.desc()).limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    total_playlists = await db.execute(select(func.count(GeneratedPlaylist.id)))
    total_playlists = total_playlists.scalar() or 0

    matched_result = await db.execute(select(func.sum(GeneratedPlaylist.matched_count)))
    total_matched = matched_result.scalar() or 0

    missing_result = await db.execute(select(func.sum(GeneratedPlaylist.missing_count)))
    total_missing = missing_result.scalar() or 0

    wh_success_result = await db.execute(
        select(func.count(WebhookBatch.id)).where(WebhookBatch.status == "success")
    )
    wh_success = wh_success_result.scalar() or 0

    wh_failed_result = await db.execute(
        select(func.count(WebhookBatch.id)).where(WebhookBatch.status.in_(["failed", "retrying"]))
    )
    wh_failed = wh_failed_result.scalar() or 0

    return {
        "total_runs": total_runs,
        "last_run": {
            "id": last_run.id,
            "run_type": last_run.run_type,
            "status": last_run.status,
            "created_at": last_run.created_at.isoformat() if last_run else None,
        } if last_run else None,
        "total_playlists": total_playlists,
        "total_matched": total_matched,
        "total_missing": total_missing,
        "webhook_success_count": wh_success,
        "webhook_failed_count": wh_failed,
    }


@router.get("/trends")
async def get_trends(days: int = 7, current_user: CurrentUser = None):
    # TODO: implement trends data aggregation
    return {"days": days, "data": []}