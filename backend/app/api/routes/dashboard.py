"""Dashboard summary routes."""

from fastapi import APIRouter
from sqlalchemy import select, func

from app.api.deps import CurrentUser

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        # Total runs
        runs_result = await session.execute(
            select(func.count(__import__("app.db.models").RecommendationRun.id))
        )
        total_runs = runs_result.scalar() or 0

        # Recent run status
        last_run_result = await session.execute(
            select(__import__("app.db.models").RecommendationRun)
            .order_by(__import__("app.db.models").RecommendationRun.created_at.desc())
            .limit(1)
        )
        last_run = last_run_result.scalar_one_or_none()

        # Total playlists generated
        pl_result = await session.execute(
            select(func.count(__import__("app.db.models").GeneratedPlaylist.id))
        )
        total_playlists = pl_result.scalar() or 0

        # Total matched / missing
        matched_result = await session.execute(
            select(func.sum(__import__("app.db.models").GeneratedPlaylist.matched_count))
        )
        total_matched = matched_result.scalar() or 0
        missing_result = await session.execute(
            select(func.sum(__import__("app.db.models").GeneratedPlaylist.missing_count))
        )
        total_missing = missing_result.scalar() or 0

        # Webhook stats
        wh_success = await session.execute(
            select(func.count(__import__("app.db.models").WebhookBatch.id))
            .where(__import__("app.db.models").WebhookBatch.status == "success")
        )
        wh_failed = await session.execute(
            select(func.count(__import__("app.db.models").WebhookBatch.id))
            .where(__import__("app.db.models").WebhookBatch.status.in_(["failed", "retrying"])
        )

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
            "webhook_success_count": wh_success.scalar() or 0,
            "webhook_failed_count": wh_failed.scalar() or 0,
        }


@router.get("/trends")
async def get_trends(days: int = 7, current_user: CurrentUser = None):
    # Placeholder: return last N days run summary
    return {"days": days, "data": []}  # TODO: implement