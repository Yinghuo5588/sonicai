"""missed_tracks API - view and manage the unmatched-track task pool."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.db.models import MissedTrack

router = APIRouter(prefix="/missed-tracks", tags=["missed-tracks"])


@router.get("")
async def list_missed_tracks(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List missed-track records with optional status filter and search."""
    query = select(MissedTrack).order_by(MissedTrack.created_at.desc())

    if status:
        query = query.where(MissedTrack.status == status)

    if q:
        keyword = f"%{q}%"
        query = query.where(
            MissedTrack.title.ilike(keyword)
            | MissedTrack.artist.ilike(keyword)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.limit(limit).offset(offset))
    rows = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "title": r.title,
                "artist": r.artist,
                "status": r.status,
                "source": r.source,
                "seen_count": r.seen_count,
                "retry_count": r.retry_count,
                "max_retries": r.max_retries,
                "match_threshold": float(r.match_threshold or 0.75),
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
                "last_retry_at": r.last_retry_at.isoformat() if r.last_retry_at else None,
                "matched_at": r.matched_at.isoformat() if r.matched_at else None,
                "matched_navidrome_id": r.matched_navidrome_id,
                "last_error": r.last_error,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/stats")
async def missed_track_stats(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return counts per status."""
    result = await db.execute(
        select(MissedTrack.status, func.count(MissedTrack.id))
        .group_by(MissedTrack.status)
    )
    stats = {"pending": 0, "matched": 0, "failed": 0, "ignored": 0}
    for status_val, count in result.all():
        stats[status_val or "pending"] = int(count or 0)
    stats["total"] = sum(stats.values())
    return stats


@router.post("/retry")
async def retry_pending_missed_tracks(current_user: CurrentUser):
    """Trigger a manual batch retry of all pending missed tracks."""
    from app.core.task_registry import create_background_task
    from app.tasks.missed_track_tasks import retry_missed_tracks_job

    create_background_task(
        retry_missed_tracks_job(),
        name="missed-track-manual-retry",
    )
    return {"message": "缺失歌曲批量重试任务已启动"}


@router.post("/{track_id}/retry")
async def retry_one_missed_track(
    track_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retry a single missed track with local-only matching."""
    row = await db.get(MissedTrack, track_id)
    if not row:
        raise HTTPException(status_code=404, detail="Missed track not found")

    from app.services.library_match_service import match_track_local_only

    match = await match_track_local_only(
        title=row.title,
        artist=row.artist or "",
        threshold=float(row.match_threshold or 0.75),
    )

    now = datetime.now(timezone.utc)
    row.last_retry_at = now
    row.retry_count = (row.retry_count or 0) + 1
    row.updated_at = now

    if match:
        row.status = "matched"
        row.matched_at = now
        row.matched_navidrome_id = str(match.get("id")) if match.get("id") else None
        row.last_error = None
    elif row.retry_count >= row.max_retries:
        row.status = "failed"

    await db.commit()
    return {"matched": bool(match), "match": match, "status": row.status}


@router.post("/{track_id}/ignore")
async def ignore_missed_track(
    track_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Mark a missed track as ignored."""
    row = await db.get(MissedTrack, track_id)
    if not row:
        raise HTTPException(status_code=404, detail="Missed track not found")

    row.status = "ignored"
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "已忽略", "id": track_id}


@router.post("/{track_id}/reset")
async def reset_missed_track(
    track_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Reset a failed/ignored matched track back to pending."""
    row = await db.get(MissedTrack, track_id)
    if not row:
        raise HTTPException(status_code=404, detail="Missed track not found")

    row.status = "pending"
    row.retry_count = 0
    row.last_error = None
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "已重置为 pending", "id": track_id}


@router.delete("/{track_id}")
async def delete_missed_track(
    track_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single missed-track record."""
    row = await db.get(MissedTrack, track_id)
    if not row:
        raise HTTPException(status_code=404, detail="Missed track not found")

    await db.delete(row)
    await db.commit()
    return {"message": "已删除", "id": track_id}


@router.delete("/matched")
async def clear_matched_missed_tracks(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete all matched-status records."""
    result = await db.execute(
        delete(MissedTrack).where(MissedTrack.status == "matched")
    )
    deleted = result.rowcount or 0
    await db.commit()
    return {"message": f"已清理 matched 记录 {deleted} 条"}