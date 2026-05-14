"""AI recommendation routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.rate_limit import limiter
from app.core.task_registry import create_background_task
from app.db.session import get_db
from app.services.job_run_service import create_pending_run
from app.services.ai_recommend_service import run_ai_recommendation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


class AIRecommendRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    limit: int | None = Field(default=None, ge=1, le=200)
    playlist_name: str | None = Field(default=None, max_length=255)
    match_threshold: float = Field(default=0.75, gt=0.0, le=1.0)
    overwrite: bool = False


@router.post("/recommend")
@limiter.limit("3/minute")
async def recommend_with_ai(
    request: Request,
    body: AIRecommendRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Queue an AI recommendation job.

    AI generates candidate songs only.
    Matching and playlist creation are handled by the common pipeline.
    """
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    run_id = await create_pending_run(
        run_type="ai",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["ai"],
        lock_scope="ai",
        stale_after_minutes=10,
    )

    logger.info("[ai] queued run_id=%s user_id=%s", run_id, current_user.id)

    create_background_task(
        run_ai_recommendation(
            run_id=run_id,
            prompt=prompt,
            limit=body.limit,
            playlist_name=body.playlist_name,
            match_threshold=body.match_threshold,
            overwrite=body.overwrite,
            trigger_type="manual",
        ),
        name=f"ai-recommendation-{run_id}",
    )

    return {
        "message": "AI recommendation queued",
        "run_id": run_id,
        "prompt": prompt,
        "limit": body.limit,
        "playlist_name": body.playlist_name or "(auto)",
        "match_threshold": body.match_threshold,
        "overwrite": body.overwrite,
    }