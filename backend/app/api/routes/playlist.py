"""Third-party playlist sync routes."""

import logging
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import RecommendationRun
from app.api.deps import CurrentUser
from app.services.playlist_sync import run_playlist_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playlist", tags=["playlist"])


@router.post("/sync")
async def sync_playlist(
    url: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
):
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="url is required")

    from datetime import datetime, timezone, timedelta
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale_result = await db.execute(
        select(RecommendationRun).where(
            RecommendationRun.status == "running",
            RecommendationRun.run_type == "playlist",
            RecommendationRun.started_at < stale_cutoff,
        )
    )
    stale_rows = stale_result.scalars().all()
    if stale_rows:
        for row in stale_rows:
            row.status = "failed"
            row.error_message = "Stale job cleaned - auto-marked failed"
            row.finished_at = datetime.now(timezone.utc)
        await db.commit()

    result = await db.execute(
        select(RecommendationRun.id).where(
            RecommendationRun.status.in_(["pending", "running"]),
            RecommendationRun.run_type == "playlist",
        ).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A playlist sync is already running")

    run = RecommendationRun(
        run_type="playlist",
        trigger_type="manual",
        status="pending",
        created_by_user_id=current_user.id,
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()

    logger.info(f"[playlist] queued run_id={run_id} url={url} user_id={current_user.id}")
    asyncio.create_task(
        run_playlist_sync(
            run_id=run_id,
            url=url.strip(),
            match_threshold=match_threshold,
            playlist_name=playlist_name,
            overwrite=overwrite,
        )
    )

    return {
        "message": "Playlist sync queued",
        "run_id": run_id,
        "url": url,
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(auto)",
        "overwrite": overwrite,
    }
