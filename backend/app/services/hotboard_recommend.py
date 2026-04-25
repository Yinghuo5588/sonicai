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


async def _update_run_status(db: AsyncSession, run_id: int, status: str, error: str | None = None):
    """Update run status — helper to avoid scattered commits."""
    run_row = await db.get(RecommendationRun, run_id)
    if run_row:
        run_row.status = status
        run_row.finished_at = datetime.now(timezone.utc)
        if error:
            run_row.error_message = error
        await db.commit()


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
    logger.info(f"[hotboard] start run_id={run_id} limit={limit} threshold={match_threshold}")

    async with AsyncSessionLocal() as db:
        # Mark as running
        await _update_run_status(db, run_id, "running")

    try:
        # 1. Fetch hotboard
        hot_tracks = await fetch_netease_hotboard(limit=limit)
        logger.info(f"[hotboard] fetched {len(hot_tracks)} tracks")

        if not hot_tracks:
            async with AsyncSessionLocal() as db:
                await _update_run_status(db, run_id, "failed", "Failed to fetch hotboard data")
            return {"matched": 0, "missing": 0, "total": 0, "error": "fetch failed"}

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Resolve playlist name
        final_name = playlist_name.strip() if playlist_name and playlist_name.strip() else f"网易云热榜 - {today}"

        # Overwrite: delete existing playlist with same name from Navidrome
        if overwrite:
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    logger.info(f"[hotboard] overwriting playlist name={final_name} id={pl['id']}")
                    await navidrome_delete_playlist(str(pl["id"]))
                    break

        # All DB writes in ONE session — avoids partial-commit issues
        async with AsyncSessionLocal() as db:
            playlist = GeneratedPlaylist(
                run_id=run_id,
                playlist_type="hotboard",
                playlist_name=final_name,
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
                    db.add(NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=True,
                        search_query=f"{title} {artist}",
                        selected_song_id=best_match["id"],
                        selected_title=best_match.get("title"),
                        selected_artist=best_match.get("artist"),
                        selected_album=best_match.get("album"),
                        confidence_score=best_match["score"],
                        raw_response_json="",
                    ))
                else:
                    db.add(NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=False,
                        search_query=f"{title} {artist}",
                    ))
                    missing_items.append(track)

                if (idx + 1) % 20 == 0:
                    logger.info(f"[hotboard] matching progress: {idx+1}/{len(hot_tracks)}")

            logger.info(
                f"[hotboard] done total={len(hot_tracks)} "
                f"matched={len(matched_ids)} missing={len(missing_items)}"
            )

            playlist.total_candidates = len(hot_tracks)
            playlist.matched_count = len(matched_ids)
            playlist.missing_count = len(missing_items)

            navidrome_playlist_id: str | None = None
            if matched_ids:
                navidrome_playlist_id = await navidrome_create_playlist(final_name)
                if navidrome_playlist_id:
                    ok = await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_ids)
                    if ok:
                        playlist.navidrome_playlist_id = str(navidrome_playlist_id)
                    else:
                        playlist.error_message = "Failed to add songs to Navidrome playlist"
                        await navidrome_delete_playlist(str(navidrome_playlist_id))
                        playlist.status = "failed"
                        await _update_run_status(db, run_id, "failed", "Failed to add songs")
                        return {
                            "matched": len(matched_ids),
                            "missing": len(missing_items),
                            "total": len(hot_tracks),
                            "error": "Failed to add songs",
                        }

            playlist.status = "success"
            await db.commit()

        # Finally update run status
        async with AsyncSessionLocal() as db:
            await _update_run_status(db, run_id, "success")

        # Webhook for missing items (if library mode allows)
        if missing_items:
            async with AsyncSessionLocal() as db:
                settings_result = await db.execute(select(SystemSettings))
                settings = settings_result.scalar_one_or_none()
                if settings and settings.library_mode_default == "allow_missing" and settings.webhook_url:
                    from app.db.models import WebhookBatch, WebhookBatchItem
                    batch = WebhookBatch(
                        run_id=run_id,
                        playlist_type="hotboard",
                        status="pending",
                        max_retry_count=settings.webhook_retry_count or 3,
                    )
                    db.add(batch)
                    await db.flush()
                    for item_data in missing_items:
                        text = f"{item_data.get('album', '')} - {item_data['artist']}" if item_data.get("album") else f"{item_data['title']} - {item_data['artist']}"
                        db.add(WebhookBatchItem(
                            batch_id=batch.id,
                            track=item_data["title"],
                            artist=item_data["artist"],
                            album=item_data.get("album"),
                            text=text,
                        ))
                    await db.commit()
                    # Fire-and-forget
                    from app.services.webhook_service import send_webhook_batch
                    await send_webhook_batch(batch.id)

        return {
            "playlist_name": final_name,
            "matched": len(matched_ids),
            "missing": len(missing_items),
            "total": len(hot_tracks),
            "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
        }

    except Exception as e:
        logger.exception(f"[hotboard] run failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            await _update_run_status(db, run_id, "failed", str(e))
        raise


def _pick_best_match(title: str, artist: str, nav_results: list[dict], threshold: float) -> dict | None:
    if not nav_results:
        return None

    scored = []
    for r in nav_results:
        scores = score_candidate(title, artist, r.get("title") or "", r.get("artist") or "")
        if scores["score"] >= threshold:
            scored.append((scores["score"], r))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    return {
        "id": best.get("id"),
        "title": best.get("title"),
        "artist": best.get("artist"),
        "album": best.get("album"),
        "score": best_score,
    }
