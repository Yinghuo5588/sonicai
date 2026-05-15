"""AI recommendation scheduled job routes."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.rate_limit import limiter
from app.core.task_registry import create_background_task
from app.db.session import get_db
from app.db.models import AIRecommendationJob
from app.services.job_run_service import create_pending_run
from app.services.ai_recommend_service import run_ai_recommendation


router = APIRouter(prefix="/ai/jobs", tags=["ai"])


def _validate_cron(expr: str):
    if len(str(expr or "").split()) != 5:
        raise HTTPException(status_code=400, detail="cron_expression must be a valid 5-field cron expression")


class AIJobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    enabled: bool = False
    cron_expression: str = Field(min_length=1, max_length=100)

    prompt: str = Field(min_length=1, max_length=4000)
    mode: Literal["free", "favorites"] = "free"
    limit: int | None = Field(default=30, ge=1, le=200)
    playlist_name: str | None = Field(default=None, max_length=255)
    match_threshold: float = Field(default=0.75, gt=0.0, le=1.0)
    overwrite: bool = False
    use_preference_profile: bool = True


class AIJobUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    enabled: bool | None = None
    cron_expression: str | None = Field(default=None, max_length=100)

    prompt: str | None = Field(default=None, min_length=1, max_length=4000)
    mode: Literal["free", "favorites"] | None = None
    limit: int | None = Field(default=None, ge=1, le=200)
    playlist_name: str | None = Field(default=None, max_length=255)
    match_threshold: float | None = Field(default=None, gt=0.0, le=1.0)
    overwrite: bool | None = None
    use_preference_profile: bool | None = None


def _job_to_dict(job: AIRecommendationJob):
    return {
        "id": job.id,
        "name": job.name,
        "enabled": bool(job.enabled),
        "cron_expression": job.cron_expression,
        "prompt": job.prompt,
        "mode": job.mode,
        "limit": job.limit,
        "playlist_name": job.playlist_name,
        "match_threshold": float(job.match_threshold or 0.75),
        "overwrite": bool(job.overwrite),
        "use_preference_profile": bool(job.use_preference_profile),
        "created_by_user_id": job.created_by_user_id,
        "last_run_at": job.last_run_at.isoformat() if job.last_run_at else None,
        "last_error": job.last_error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


@router.get("")
async def list_ai_jobs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIRecommendationJob).order_by(AIRecommendationJob.id.desc())
    )
    rows = result.scalars().all()
    return {"items": [_job_to_dict(row) for row in rows]}


@router.post("")
async def create_ai_job(
    body: AIJobCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _validate_cron(body.cron_expression)

    job = AIRecommendationJob(
        name=body.name.strip(),
        enabled=body.enabled,
        cron_expression=body.cron_expression.strip(),
        prompt=body.prompt.strip(),
        mode=body.mode,
        limit=body.limit or 30,
        playlist_name=body.playlist_name,
        match_threshold=body.match_threshold,
        overwrite=body.overwrite,
        use_preference_profile=body.use_preference_profile,
        created_by_user_id=current_user.id,
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return _job_to_dict(job)


@router.put("/{job_id}")
async def update_ai_job(
    job_id: int,
    body: AIJobUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AIRecommendationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found")

    data = body.model_dump(exclude_unset=True)

    if "cron_expression" in data and data["cron_expression"]:
        _validate_cron(data["cron_expression"])

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(job, key, value)

    job.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(job)

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return _job_to_dict(job)


@router.delete("/{job_id}")
async def delete_ai_job(
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AIRecommendationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found")

    await db.delete(job)
    await db.commit()

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return {"message": "AI job deleted", "id": job_id}


@router.post("/{job_id}/run")
@limiter.limit("3/minute")
async def run_ai_job_now(
    request: Request,
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AIRecommendationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found")

    run_id = await create_pending_run(
        run_type="ai",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["ai"],
        lock_scope="ai",
        stale_after_minutes=10,
    )

    create_background_task(
        run_ai_recommendation(
            run_id=run_id,
            prompt=job.prompt,
            mode=job.mode or "free",
            limit=job.limit or 30,
            playlist_name=job.playlist_name,
            match_threshold=float(job.match_threshold or 0.75),
            overwrite=bool(job.overwrite),
            trigger_type="manual",
            use_preference_profile=bool(job.use_preference_profile),
        ),
        name=f"ai-job-manual-{job_id}-{run_id}",
    )

    return {
        "message": "AI job queued",
        "job_id": job_id,
        "run_id": run_id,
    }