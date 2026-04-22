"""Runs and playlists routes."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import RecommendationRun, GeneratedPlaylist, RecommendationItem, NavidromeMatch
from app.api.deps import CurrentUser

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("")
async def list_runs(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecommendationRun)
        .order_by(RecommendationRun.created_at.desc())
        .limit(50)
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "run_type": r.run_type,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/{run_id}")
async def get_run(run_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecommendationRun).where(RecommendationRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "id": run.id,
        "run_type": run.run_type,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "error_message": run.error_message,
        "config_snapshot_json": run.config_snapshot_json,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/{run_id}/playlists")
async def get_run_playlists(run_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GeneratedPlaylist).where(GeneratedPlaylist.run_id == run_id)
    )
    playlists = result.scalars().all()
    return [
        {
            "id": p.id,
            "run_id": p.run_id,
            "playlist_type": p.playlist_type,
            "playlist_name": p.playlist_name,
            "playlist_date": p.playlist_date,
            "navidrome_playlist_id": p.navidrome_playlist_id,
            "status": p.status,
            "total_candidates": p.total_candidates,
            "matched_count": p.matched_count,
            "missing_count": p.missing_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in playlists
    ]


@router.get("/{run_id}/playlists/{playlist_id}/items")
async def get_playlist_items(
    run_id: int,
    playlist_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    pl_result = await db.execute(
        select(GeneratedPlaylist)
        .where(GeneratedPlaylist.id == playlist_id)
        .where(GeneratedPlaylist.run_id == run_id)
    )
    playlist = pl_result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    items_result = await db.execute(
        select(RecommendationItem, NavidromeMatch)
        .outerjoin(NavidromeMatch, NavidromeMatch.recommendation_item_id == RecommendationItem.id)
        .where(RecommendationItem.generated_playlist_id == playlist_id)
        .order_by(RecommendationItem.rank_index)
        .limit(limit)
        .offset(offset)
    )
    rows = items_result.all()

    count_result = await db.execute(
        select(func.count(RecommendationItem.id))
        .where(RecommendationItem.generated_playlist_id == playlist_id)
    )
    total = count_result.scalar() or 0

    items = []
    for item, match in rows:
        items.append({
            "id": item.id,
            "rank_index": item.rank_index,
            "title": item.title,
            "artist": item.artist,
            "album": item.album,
            "score": float(item.score) if item.score else None,
            "source_type": item.source_type,
            "source_seed_name": item.source_seed_name,
            "source_seed_artist": item.source_seed_artist,
            "matched": match.matched if match else False,
            "selected_title": match.selected_title if match else None,
            "selected_artist": match.selected_artist if match else None,
            "selected_album": match.selected_album if match else None,
            "confidence_score": float(match.confidence_score) if match and match.confidence_score else None,
            "search_query": match.search_query if match else None,
        })

    return {
        "playlist": {
            "id": playlist.id,
            "playlist_name": playlist.playlist_name,
            "playlist_type": playlist.playlist_type,
            "playlist_date": playlist.playlist_date,
            "status": playlist.status,
            "total_candidates": playlist.total_candidates,
            "matched_count": playlist.matched_count,
            "missing_count": playlist.missing_count,
            "navidrome_playlist_id": playlist.navidrome_playlist_id,
        },
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GeneratedPlaylist).where(GeneratedPlaylist.id == playlist_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {
        "id": p.id,
        "run_id": p.run_id,
        "playlist_type": p.playlist_type,
        "playlist_name": p.playlist_name,
        "playlist_date": p.playlist_date,
        "navidrome_playlist_id": p.navidrome_playlist_id,
        "status": p.status,
        "total_candidates": p.total_candidates,
        "matched_count": p.matched_count,
        "missing_count": p.missing_count,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/playlists/{playlist_id}/items")
async def get_playlist_items_by_id(
    playlist_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    pl_result = await db.execute(select(GeneratedPlaylist).where(GeneratedPlaylist.id == playlist_id))
    playlist = pl_result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return await get_playlist_items(playlist_id, playlist_id, current_user, db, limit, offset)