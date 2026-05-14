"""Song library routes — Phase 6."""

from fastapi import APIRouter, Depends, Query, Request
from app.core.rate_limit import limiter
from pydantic import BaseModel
from sqlalchemy import select, func, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.db.models import SongLibrary, MatchLog, ManualMatch, MatchCache
from app.services.song_library_service import (
    sync_navidrome_to_song_library,
    song_library_count,
)
from app.services.song_cache import song_cache
from app.core.task_registry import create_background_task
from app.utils.text_normalizer import (
    normalize_for_compare,
    normalize_artist,
    generate_title_aliases,
    generate_artist_aliases,
)

router = APIRouter(prefix="/library", tags=["library"])


# ── Request models ──────────────────────────────────────────────────────────────

class ManualMatchCreateRequest(BaseModel):
    input_title: str
    input_artist: str | None = None
    navidrome_id: str
    note: str | None = None


class DebugMatchRequest(BaseModel):
    title: str
    artist: str | None = ""
    threshold: float = 0.75


# ── Status & sync ──────────────────────────────────────────────────────────────

@router.get("/status")
async def library_status(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(select(func.count(SongLibrary.id)))
    total = total_result.scalar() or 0

    from app.services.favorite_tracks_service import favorite_tracks_status

    return {
        "total_songs": total,
        "cache": song_cache.status(),
        "favorites": await favorite_tracks_status(),
    }


@router.post("/sync")
@limiter.limit("2/minute")
async def sync_library(
    request: Request,
    current_user: CurrentUser,
):
    async def _sync_and_reload():
        await sync_navidrome_to_song_library()
        await song_cache.refresh_full(skip_sync=True)

    create_background_task(_sync_and_reload(), name="song-library-sync")

    return {
        "message": "曲库同步任务已启动",
    }


# ── Favorites ─────────────────────────────────────────────────────────────────

@router.get("/favorites/status")
async def library_favorites_status(
    current_user: CurrentUser,
):
    from app.services.favorite_tracks_service import favorite_tracks_status
    return await favorite_tracks_status()


@router.post("/favorites/sync")
@limiter.limit("2/minute")
async def sync_library_favorites(
    request: Request,
    current_user: CurrentUser,
):
    from app.core.task_registry import create_background_task
    from app.services.favorite_tracks_service import sync_navidrome_favorites_to_db

    create_background_task(
        sync_navidrome_favorites_to_db(),
        name="navidrome-favorites-sync",
    )

    return {
        "message": "Navidrome 收藏歌曲同步任务已启动",
    }


@router.get("/favorites/songs")
async def list_library_favorite_songs(
    current_user: CurrentUser,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    from app.services.favorite_tracks_service import list_favorite_tracks

    return await list_favorite_tracks(
        q=q,
        limit=limit,
        offset=offset,
    )


# ── Songs ──────────────────────────────────────────────────────────────────────

@router.get("/songs")
async def list_songs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    query = select(SongLibrary).order_by(SongLibrary.id.desc())

    if q:
        keyword = f"%{q}%"
        query = query.where(
            SongLibrary.title.ilike(keyword) |
            SongLibrary.artist.ilike(keyword) |
            SongLibrary.album.ilike(keyword)
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
                "navidrome_id": r.navidrome_id,
                "title": r.title,
                "artist": r.artist,
                "album": r.album,
                "duration": r.duration,
                "source": r.source,
                "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            }
            for r in rows
        ],
    }


# ── Match logs ─────────────────────────────────────────────────────────────────

@router.get("/match-logs")
async def list_match_logs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    total_result = await db.execute(select(func.count(MatchLog.id)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(MatchLog)
        .order_by(MatchLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "input_title": r.input_title,
                "input_artist": r.input_artist,
                "matched": r.matched,
                "navidrome_id": r.navidrome_id,
                "selected_title": r.selected_title,
                "selected_artist": r.selected_artist,
                "confidence_score": float(r.confidence_score) if r.confidence_score else None,
                "source": r.source,
                "raw_json": r.raw_json,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/match-logs/old")
async def clear_old_match_logs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365),
):
    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        delete(MatchLog).where(MatchLog.created_at < cutoff)
    )
    deleted = result.rowcount
    await db.commit()

    return {"message": f"已清理 {days} 天以前的匹配日志，共 {deleted} 条"}


# ── Manual matches ─────────────────────────────────────────────────────────────

@router.get("/manual-matches")
async def list_manual_matches(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    total_result = await db.execute(select(func.count(ManualMatch.id)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(ManualMatch)
        .order_by(ManualMatch.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "input_title": r.input_title,
                "input_artist": r.input_artist,
                "navidrome_id": r.navidrome_id,
                "note": r.note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/manual-matches")
async def create_manual_match(
    body: ManualMatchCreateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    input_title = body.input_title.strip()
    input_artist = (body.input_artist or "").strip()
    navidrome_id = body.navidrome_id.strip()

    if not input_title:
        return {"message": "input_title is required"}
    if not navidrome_id:
        return {"message": "navidrome_id is required"}

    title_norm = normalize_for_compare(input_title)
    artist_norm = normalize_artist(input_artist)

    song_result = await db.execute(
        select(SongLibrary).where(SongLibrary.navidrome_id == navidrome_id)
    )
    song = song_result.scalar_one_or_none()

    existing_result = await db.execute(
        select(ManualMatch).where(
            ManualMatch.input_title_norm == title_norm,
            ManualMatch.input_artist_norm == artist_norm,
        )
    )
    row = existing_result.scalar_one_or_none()

    if not row:
        row = ManualMatch(
            input_title=input_title,
            input_artist=input_artist,
            input_title_norm=title_norm,
            input_artist_norm=artist_norm,
        )
        db.add(row)

    row.navidrome_id = navidrome_id
    row.song_id = song.id if song else None
    row.note = body.note

    await db.commit()

    return {
        "message": "人工匹配已保存",
        "input_title": input_title,
        "input_artist": input_artist,
        "navidrome_id": navidrome_id,
    }


@router.delete("/manual-matches/{match_id}")
async def delete_manual_match(
    match_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(ManualMatch, match_id)
    if not row:
        return {"message": "not found"}

    await db.delete(row)
    await db.commit()

    return {"message": "人工匹配已删除", "id": match_id}


# ── Match cache ────────────────────────────────────────────────────────────────

@router.delete("/match-cache")
async def clear_match_cache(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(MatchCache))
    await db.commit()
    return {"message": "匹配缓存已清空"}


@router.delete("/match-cache/low-confidence")
async def clear_low_confidence_match_cache(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    max_score: float = Query(default=0.75, ge=0.0, le=1.0),
):
    result = await db.execute(
        delete(MatchCache).where(MatchCache.confidence_score < max_score)
    )
    deleted = result.rowcount
    await db.commit()
    return {"message": f"已清理低于 {max_score} 的匹配缓存，共 {deleted} 条"}


# ── Debug match ────────────────────────────────────────────────────────────────

@router.post("/debug-match")
async def debug_match(
    body: DebugMatchRequest,
    current_user: CurrentUser,
):
    from app.services.library_match_service import match_track_debug
    import time

    title = body.title.strip()
    artist = (body.artist or "").strip()
    threshold = float(body.threshold or 0.75)

    t0 = time.time()
    debug_result = await match_track_debug(title=title, artist=artist, threshold=threshold)
    elapsed = round((time.time() - t0) * 1000, 2)

    return {
        "input": {
            "title": title,
            "artist": artist,
            "threshold": threshold,
            "title_norm": normalize_for_compare(title),
            "artist_norm": normalize_artist(artist),
            "title_aliases": sorted(generate_title_aliases(title)),
            "artist_aliases": sorted(generate_artist_aliases(artist)),
        },
        "result": debug_result.get("result"),
        "steps": debug_result.get("steps", []),
        "total_elapsed_ms": elapsed,
        "cache_status": song_cache.status(),
    }