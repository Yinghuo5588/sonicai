"""Playlist sync job routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.rate_limit import limiter
from app.core.task_registry import create_background_task
from app.db.session import get_db
from app.db.models import PlaylistSyncJob
from app.services.job_run_service import create_pending_run
from app.services.playlist_incremental import run_incremental_playlist_sync


router = APIRouter(prefix="/playlist-sync-jobs", tags=["playlist"])


def _validate_cron(expr: str):
    if len(str(expr or "").split()) != 5:
        raise HTTPException(status_code=400, detail="cron_expression must be a valid 5-field cron expression")


class PlaylistSyncJobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    enabled: bool = False
    cron_expression: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=1000)
    match_threshold: float = Field(default=0.75, gt=0.0, le=1.0)
    playlist_name: str | None = Field(default=None, max_length=255)
    overwrite: bool = False


class PlaylistSyncJobUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    enabled: bool | None = None
    cron_expression: str | None = Field(default=None, max_length=100)
    url: str | None = Field(default=None, min_length=1, max_length=1000)
    match_threshold: float | None = Field(default=None, gt=0.0, le=1.0)
    playlist_name: str | None = Field(default=None, max_length=255)
    overwrite: bool | None = None
    reset_hash: bool | None = False


def _job_to_dict(job: PlaylistSyncJob):
    return {
        "id": job.id,
        "name": job.name,
        "enabled": bool(job.enabled),
        "cron_expression": job.cron_expression,
        "url": job.url,
        "match_threshold": float(job.match_threshold or 0.75),
        "playlist_name": job.playlist_name,
        "overwrite": bool(job.overwrite),
        "last_hash": job.last_hash,
        "created_by_user_id": job.created_by_user_id,
        "last_run_at": job.last_run_at.isoformat() if job.last_run_at else None,
        "last_error": job.last_error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


@router.get("")
async def list_playlist_sync_jobs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlaylistSyncJob).order_by(PlaylistSyncJob.id.desc())
    )
    rows = result.scalars().all()
    return {"items": [_job_to_dict(row) for row in rows]}


@router.post("")
async def create_playlist_sync_job(
    body: PlaylistSyncJobCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    _validate_cron(body.cron_expression)

    job = PlaylistSyncJob(
        name=body.name.strip(),
        enabled=body.enabled,
        cron_expression=body.cron_expression.strip(),
        url=body.url.strip(),
        match_threshold=body.match_threshold,
        playlist_name=body.playlist_name,
        overwrite=body.overwrite,
        created_by_user_id=current_user.id,
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return _job_to_dict(job)


@router.put("/{job_id}")
async def update_playlist_sync_job(
    job_id: int,
    body: PlaylistSyncJobUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(PlaylistSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Playlist sync job not found")

    data = body.model_dump(exclude_unset=True)

    reset_hash = bool(data.pop("reset_hash", False))

    if "cron_expression" in data and data["cron_expression"]:
        _validate_cron(data["cron_expression"])

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(job, key, value)

    if reset_hash:
        job.last_hash = None

    job.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(job)

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return _job_to_dict(job)


@router.delete("/{job_id}")
async def delete_playlist_sync_job(
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(PlaylistSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Playlist sync job not found")

    await db.delete(job)
    await db.commit()

    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return {"message": "Playlist sync job deleted", "id": job_id}


@router.post("/{job_id}/run")
@limiter.limit("3/minute")
async def run_playlist_sync_job_now(
    request: Request,
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(PlaylistSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Playlist sync job not found")

    if not job.url:
        raise HTTPException(status_code=400, detail="url is required")

    run_id = await create_pending_run(
        run_type="playlist",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["playlist"],
        lock_scope="playlist",
        stale_after_minutes=10,
    )

    create_background_task(
        run_incremental_playlist_sync(
            run_id=run_id,
            url=job.url,
            match_threshold=float(job.match_threshold or 0.75),
            playlist_name=job.playlist_name,
            overwrite=bool(job.overwrite),
            playlist_sync_job_id=job.id,
        ),
        name=f"playlist-sync-job-manual-{job_id}-{run_id}",
    )

    return {
        "message": "Playlist sync job queued",
        "job_id": job_id,
        "run_id": run_id,
    }


@router.post("/{job_id}/reset-hash")
async def reset_playlist_sync_job_hash(
    job_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(PlaylistSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Playlist sync job not found")

    job.last_hash = None
    job.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(job)

    return _job_to_dict(job)