"""Hotboard sync routes."""

import logging
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import RecommendationRun
from app.api.deps import CurrentUser
from app.services.hotboard_recommend import run_hotboard_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hotboard", tags=["hotboard"])


@router.post("/sync")
async def sync_hotboard(
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

    # Clean up any stale hotboard jobs stuck in "running" state (≥10 min)
    from datetime import datetime, timezone, timedelta
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale_result = await db.execute(
        select(RecommendationRun)
        .where(
            RecommendationRun.status == "running",
            RecommendationRun.run_type == "hotboard",
            RecommendationRun.started_at < stale_cutoff,
        )
    )
    stale_rows = stale_result.scalars().all()
    if stale_rows:
        logger.info(f"[hotboard] cleaning {len(stale_rows)} stale stuck hotboard runs")
        for row in stale_rows:
            row.status = "failed"
            row.error_message = "Stale job cleaned — auto-marked failed"
            row.finished_at = datetime.now(timezone.utc)
        await db.commit()

    # Check for currently running jobs
    result = await db.execute(
        select(RecommendationRun.id).where(
            RecommendationRun.status.in_(["pending", "running"]),
            RecommendationRun.run_type == "hotboard",
        ).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A hotboard sync is already running")

    run = RecommendationRun(
        run_type="hotboard",
        trigger_type="manual",
        status="pending",
        created_by_user_id=current_user.id,
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()

    logger.info(f"[hotboard] queued run_id={run_id} user_id={current_user.id}")
    asyncio.create_task(
        run_hotboard_sync(
            run_id=run_id,
            limit=limit,
            match_threshold=match_threshold,
            playlist_name=playlist_name,
            overwrite=overwrite,
        )
    )

    return {
        "message": "Hotboard sync queued",
        "run_id": run_id,
        "limit": limit,
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(自动日期)",
        "overwrite": overwrite,
    }
