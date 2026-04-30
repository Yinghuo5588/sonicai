"""Hotboard sync routes."""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from app.core.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import RecommendationRun
from app.api.deps import CurrentUser
from app.services.job_run_service import create_pending_run
from app.services.hotboard_recommend import run_hotboard_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hotboard", tags=["hotboard"])


@router.post("/sync")
@limiter.limit("3/minute")
async def sync_hotboard(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
):
    """
    Trigger a hotboard sync:
    - Fetches top N tracks from NetEase hotboard (default 50, max 200)
    - Matches each against Navidrome via multi-strategy fuzzy search
    - Creates (or overwrites) a Navidrome playlist with matched songs
    - playlist_name: custom playlist name (default "网易云热榜 - YYYY-MM-DD")
    - overwrite: if True, deletes any existing playlist with the same name first
    Returns immediately; sync runs in background.
    """
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")
    if not (0.0 < match_threshold <= 1.0):
        raise HTTPException(status_code=400, detail="match_threshold must be between 0 and 1")

    run_id = await create_pending_run(
        run_type="hotboard",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["hotboard"],
        lock_scope="hotboard",
        stale_after_minutes=10,
    )

    from app.core.task_registry import create_background_task
    logger.info(f"[hotboard] queued run_id={run_id} user_id={current_user.id}")
    create_background_task(
        run_hotboard_sync(
            run_id=run_id,
            limit=limit,
            match_threshold=match_threshold,
            playlist_name=playlist_name,
            overwrite=overwrite,
        ),
        name=f"hotboard-sync-{run_id}",
    )

    return {
        "message": "Hotboard sync queued",
        "run_id": run_id,
        "limit": limit,
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(自动日期)",
        "overwrite": overwrite,
    }
