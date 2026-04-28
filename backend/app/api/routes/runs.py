from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import GeneratedPlaylist, RecommendationItem, NavidromeMatch, RecommendationRun
from app.db.session import get_db

router = APIRouter(prefix="/runs", tags=["runs"])


# ── Shared helper (defined BEFORE endpoints that call it) ────────────────────────

async def get_playlist_items(
    run_id: int,
    playlist_id: int,
    db: AsyncSession,
    limit: int,
    offset: int,
):
    """Return playlist + items, used by all playlist-item endpoints."""
    pl_result = await db.execute(
        select(GeneratedPlaylist)
        .where(GeneratedPlaylist.id == playlist_id)
        .where(GeneratedPlaylist.run_id == run_id)
    )
    playlist = pl_result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    count_result = await db.execute(
        select(func.count(RecommendationItem.id))
        .where(RecommendationItem.generated_playlist_id == playlist_id)
    )
    total = count_result.scalar()

    items_result = await db.execute(
        select(RecommendationItem)
        .where(RecommendationItem.generated_playlist_id == playlist_id)
        .order_by(RecommendationItem.rank_index, RecommendationItem.id)
        .limit(limit)
        .offset(offset)
    )
    items = items_result.scalars().all()

    if items:
        match_result = await db.execute(
            select(NavidromeMatch)
            .where(NavidromeMatch.recommendation_item_id.in_([i.id for i in items]))
        )
        matches = {m.recommendation_item_id: m for m in match_result.scalars().all()}
    else:
        matches = {}

    enriched = []
    for item in items:
        m = matches.get(item.id)
        enriched.append({
            "id": item.id,
            "title": item.title,
            "artist": item.artist,
            "album": item.album,
            "score": item.score,
            "source_type": item.source_type,
            "source_seed_name": item.source_seed_name,
            "source_seed_artist": item.source_seed_artist,
            "rank_index": item.rank_index,
            "navidrome_id": m.selected_song_id if m else None,
            "navidrome_title": m.selected_title if m else None,
            "navidrome_artist": m.selected_artist if m else None,
            "matched": m.matched if m else False,
            "confidence_score": m.confidence_score if m else None,
            "search_query": m.search_query if m else None,
        })

    return {
        "playlist": {
            "id": playlist.id,
            "name": playlist.playlist_name,
            "playlist_type": playlist.playlist_type,
            "status": playlist.status,
            "matched_count": playlist.matched_count,
            "missing_count": playlist.missing_count,
            "total_candidates": playlist.total_candidates,
            "navidrome_playlist_id": playlist.navidrome_playlist_id,
            "created_at": playlist.created_at.isoformat() if playlist.created_at else None,
        },
        "items": enriched,
        "total": total,
    }


# ── Endpoints (all use helpers defined above) ─────────────────────────────────

# NOTE: /playlists/{playlist_id}/items MUST be before /{run_id}/playlists/{playlist_id}/items
# to prevent FastAPI matching "playlists" as a run_id integer.

@router.get("/playlists/{playlist_id}/items")
async def get_playlist_items_by_id(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
):
    """Get items by playlist_id alone (used by PlaylistDetailPage)."""
    pl_result = await db.execute(
        select(GeneratedPlaylist).where(GeneratedPlaylist.id == playlist_id)
    )
    playlist = pl_result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return await get_playlist_items(playlist.run_id, playlist_id, db, limit, offset)


@router.get("/{run_id}/playlists/{playlist_id}/items")
async def get_playlist_items_by_run_and_playlist(
    run_id: int,
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """Get items scoped to run+playlist."""
    return await get_playlist_items(run_id, playlist_id, db, limit, offset)


# ── Runs ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_runs(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    count_result = await db.execute(select(func.count(RecommendationRun.id)))
    total = count_result.scalar()

    result = await db.execute(
        select(RecommendationRun)
        .order_by(RecommendationRun.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    runs = result.scalars().all()
    return {
        "runs": [
            {
                "id": r.id,
                "run_type": r.run_type,
                "status": r.status,
                "error_message": r.error_message,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in runs
        ],
        "total": total,
    }


@router.get("/{run_id}")
async def get_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(RecommendationRun).where(RecommendationRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # 聚合该 run 下所有歌单的进度
    playlists_result = await db.execute(
        select(GeneratedPlaylist).where(GeneratedPlaylist.run_id == run_id)
    )
    playlists = playlists_result.scalars().all()

    total_candidates = sum(p.total_candidates or 0 for p in playlists)
    total_matched = sum(p.matched_count or 0 for p in playlists)
    total_missing = sum(p.missing_count or 0 for p in playlists)

    return {
        "id": run.id,
        "run_type": run.run_type,
        "status": run.status,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "progress": {
            "total_candidates": total_candidates,
            "matched": total_matched,
            "missing": total_missing,
            "percent": round((total_matched / total_candidates * 100) if total_candidates > 0 else 0, 1),
        },
    }


@router.get("/{run_id}/playlists")
async def get_run_playlists(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(GeneratedPlaylist)
        .where(GeneratedPlaylist.run_id == run_id)
        .order_by(GeneratedPlaylist.id)
    )
    playlists = result.scalars().all()
    return [
        {
            "id": p.id,
            "playlist_name": p.playlist_name,
            "playlist_type": p.playlist_type,
            "status": p.status,
            "matched_count": p.matched_count,
            "missing_count": p.missing_count,
            "total_candidates": p.total_candidates,
            "navidrome_playlist_id": p.navidrome_playlist_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in playlists
    ]
