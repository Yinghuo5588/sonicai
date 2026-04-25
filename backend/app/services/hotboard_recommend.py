"""Hotboard-based recommendation — fetch netease hotboard and sync to Navidrome playlist."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun, GeneratedPlaylist, RecommendationItem, NavidromeMatch
from app.services.hotboard_service import fetch_netease_hotboard
from app.services.navidrome_service import (
    navidrome_multi_search,
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
    navidrome_list_playlists,
)
from app.utils.text_normalizer import score_candidate, dedup_key

logger = logging.getLogger(__name__)


# ── Pipeline ──────────────────────────────────────────────────────────────────

async def run_hotboard_sync(
    run_id: int,
    limit: int = 50,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
    trigger_type: str = "manual",
) -> dict:
    """
    Main pipeline:
    1. Fetch hotboard tracks from NetEase
    2. For each track run multi-strategy Navidrome search
    3. Score & filter by threshold
    4. Create / overwrite Navidrome playlist with matched songs
    5. Persist run results in DB
    Returns a summary dict.
    """
    logger.info(f"[hotboard] start run_id={run_id} limit={limit} threshold={match_threshold} playlist_name={playlist_name} overwrite={overwrite}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
        if not settings:
            raise RuntimeError("SystemSettings not initialized")

        run_row = await db.get(RecommendationRun, run_id)
        if not run_row:
            raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")
        run_row.status = "running"
        run_row.started_at = datetime.now(timezone.utc)
        await db.commit()

    try:
        # 1. Fetch hotboard
        hot_tracks = await fetch_netease_hotboard(limit=limit)
        logger.info(f"[hotboard] fetched {len(hot_tracks)} tracks")

        if not hot_tracks:
            async with AsyncSessionLocal() as db:
                run_row = await db.get(RecommendationRun, run_id)
                if run_row:
                    run_row.status = "failed"
                    run_row.error_message = "Failed to fetch hotboard data"
                    run_row.finished_at = datetime.now(timezone.utc)
                    await db.commit()
            return {"matched": 0, "missing": 0, "total": 0, "error": "fetch failed"}

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Determine playlist name
        if not playlist_name or playlist_name.strip() == "":
            playlist_name = f"网易云热榜 - {today}"

        # If overwrite=True, find and delete existing playlist with the same name
        navidrome_playlist_id: str | None = None
        if overwrite:
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == playlist_name:
                    pid = pl.get("id")
                    logger.info(f"[hotboard] overwriting existing playlist name={playlist_name} id={pid}")
                    if pid:
                        await navidrome_delete_playlist(str(pid))
                    break

        async with AsyncSessionLocal() as db:
            playlist = GeneratedPlaylist(
                run_id=run_id,
                playlist_type="hotboard",
                playlist_name=playlist_name,
                playlist_date=today,
                status="running",
            )
            db.add(playlist)
            await db.flush()

            matched_ids: list[str] = []
            missing_items: list[dict] = []

            for idx, track in enumerate(hot_tracks):
                title = track.get("title", "")
                artist = track.get("artist", "")

                if not title or not artist:
                    continue

                nav_results = await navidrome_multi_search(title, artist)
                best_match = _pick_best_match(title, artist, nav_results, match_threshold)

                item = RecommendationItem(
                    generated_playlist_id=playlist.id,
                    title=title,
                    artist=artist,
                    album=track.get("album", ""),
                    score=track.get("index", idx + 1),
                    source_type="hotboard",
                    source_seed_name=title,
                    source_seed_artist=artist,
                    dedup_key=dedup_key(title, artist),
                    rank_index=idx + 1,
                )
                db.add(item)
                await db.flush()

                if best_match:
                    matched_ids.append(best_match["id"])
                    nm = NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=True,
                        search_query=f"{title} {artist}",
                        selected_song_id=best_match["id"],
                        selected_title=best_match.get("title"),
                        selected_artist=best_match.get("artist"),
                        selected_album=best_match.get("album"),
                        confidence_score=best_match["score"],
                        raw_response_json="",
                    )
                else:
                    nm = NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=False,
                        search_query=f"{title} {artist}",
                    )
                    missing_items.append(track)

                db.add(nm)

                if (idx + 1) % 20 == 0:
                    logger.info(f"[hotboard] matching progress: {idx+1}/{len(hot_tracks)}")

            logger.info(
                f"[hotboard] done total={len(hot_tracks)} "
                f"matched={len(matched_ids)} missing={len(missing_items)}"
            )

            playlist.total_candidates = len(hot_tracks)
            playlist.matched_count = len(matched_ids)
            playlist.missing_count = len(missing_items)

            # 2. Create Navidrome playlist
            if matched_ids:
                navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
                if navidrome_playlist_id:
                    try:
                        await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_ids)
                        playlist.navidrome_playlist_id = str(navidrome_playlist_id)
                    except Exception as e:
                        logger.error(f"[hotboard] failed to add songs: {e}")
                        await navidrome_delete_playlist(str(navidrome_playlist_id))
                        playlist.status = "failed"
                        playlist.error_message = str(e)
                        run_row.status = "failed"
                        run_row.finished_at = datetime.now(timezone.utc)
                        run_row.error_message = str(e)
                        await db.commit()
                        return {
                            "matched": len(matched_ids),
                            "missing": len(missing_items),
                            "total": len(hot_tracks),
                            "error": str(e),
                        }

            playlist.status = "success"
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()

            return {
                "playlist_name": playlist_name,
                "matched": len(matched_ids),
                "missing": len(missing_items),
                "total": len(hot_tracks),
                "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
            }

    except Exception as e:
        logger.exception(f"[hotboard] run failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = str(e)
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        raise


# ── Scoring helpers ───────────────────────────────────────────────────────────

def _pick_best_match(title: str, artist: str, nav_results: list[dict], threshold: float) -> dict | None:
    if not nav_results:
        return None

    scored = []
    for r in nav_results:
        scores = score_candidate(title, artist, r.get("title") or "", r.get("artist") or "")
        combined = scores["score"]
        if combined >= threshold:
            scored.append((combined, r))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    logger.debug(f"[hotboard-match] title={title} artist={artist} best_score={best_score:.3f} nav_title={best.get('title')}")
    return {
        "id": best.get("id"),
        "title": best.get("title"),
        "artist": best.get("artist"),
        "album": best.get("album"),
        "score": best_score,
    }
