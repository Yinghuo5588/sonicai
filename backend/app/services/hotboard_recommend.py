"""Hotboard-based recommendation — fetch netease hotboard and sync to Navidrome playlist."""

import logging
import json as _json
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings, RecommendationRun, GeneratedPlaylist,
    RecommendationItem, NavidromeMatch, WebhookBatch, WebhookBatchItem,
)
from app.services.concurrent_search import batch_search_and_match
from app.services.hotboard_service import fetch_netease_hotboard
from app.services.navidrome_service import (
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
    navidrome_list_playlists,
)
from app.utils.text_normalizer import dedup_key
from app.services.webhook_service import send_webhook_batch

logger = logging.getLogger(__name__)


async def run_hotboard_sync(
    run_id: int,
    limit: int = 50,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
    trigger_type: str = "manual",
) -> dict:
    """
    Main pipeline — single DB session for all writes.
    """
    logger.info(f"[hotboard] start run_id={run_id} limit={limit} threshold={match_threshold}")

    # Mark run as running
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            await db.commit()

    try:
        # 1. Fetch hotboard (no DB session needed)
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
        final_name = playlist_name.strip() if playlist_name and playlist_name.strip() else f"网易云热榜 - {today}"

        # Overwrite: delete existing playlist with same name from Navidrome
        if overwrite:
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    logger.info(f"[hotboard] overwriting playlist name={final_name} id={pl['id']}")
                    await navidrome_delete_playlist(str(pl["id"]))
                    break

        # All DB writes in ONE session
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

            # Build track list for concurrent search
            search_tracks = [
                {"title": t.get("title", ""), "artist": t.get("artist", ""), "album": t.get("album", "")}
                for t in hot_tracks
            ]

            async def _log_progress(done: int, total: int):
                if done % 20 == 0:
                    logger.info(f"[hotboard] matching progress: {done}/{total}")

            search_results = await batch_search_and_match(
                tracks=search_tracks,
                threshold=match_threshold,
                concurrency=5,
                progress_callback=_log_progress,
            )

            for idx, sr in enumerate(search_results):
                track = hot_tracks[idx]
                title = sr["title"]
                artist = sr["artist"]
                if not title or not artist:
                    continue

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

                best = sr.get("best_match")
                if best:
                    matched_ids.append(best["id"])
                    db.add(NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=True,
                        search_query=f"{title} {artist}",
                        selected_song_id=best["id"],
                        selected_title=best.get("title"),
                        selected_artist=best.get("artist"),
                        selected_album=best.get("album"),
                        confidence_score=best["score"],
                    ))
                else:
                    db.add(NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=False,
                        search_query=f"{title} {artist}",
                    ))
                    missing_items.append(track)

            logger.info(f"[hotboard] done total={len(hot_tracks)} matched={len(matched_ids)} missing={len(missing_items)}")

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
                        playlist.status = "failed"
                        await navidrome_delete_playlist(str(navidrome_playlist_id))
                        run_row = await db.get(RecommendationRun, run_id)
                        if run_row:
                            run_row.status = "failed"
                            run_row.error_message = "Failed to add songs"
                            run_row.finished_at = datetime.now(timezone.utc)
                        await db.commit()
                        return {
                            "matched": len(matched_ids),
                            "missing": len(missing_items),
                            "total": len(hot_tracks),
                            "error": "Failed to add songs",
                        }

            playlist.status = "success"
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "success"
                run_row.finished_at = datetime.now(timezone.utc)

            # Webhook for missing items
            if missing_items:
                settings_result = await db.execute(select(SystemSettings))
                settings = settings_result.scalar_one_or_none()
                if settings and settings.library_mode_default == "allow_missing" and settings.webhook_url:
                    batch = WebhookBatch(
                        run_id=run_id,
                        playlist_type="hotboard",
                        status="pending",
                        max_retry_count=settings.webhook_retry_count or 3,
                        payload_json=_json.dumps({"items": missing_items}, ensure_ascii=False),
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

        # Fire-and-forget webhook (outside main session)
        if missing_items:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(WebhookBatch).where(WebhookBatch.run_id == run_id).order_by(WebhookBatch.id.desc())
                )
                batch = result.scalar_one_or_none()
                if batch:
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
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = str(e)
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        raise
