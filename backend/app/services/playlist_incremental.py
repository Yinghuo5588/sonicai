"""Incremental playlist sync — only adds new songs since last sync."""

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings, RecommendationRun, GeneratedPlaylist,
    RecommendationItem, NavidromeMatch, WebhookBatch, WebhookBatchItem,
)
from app.services.concurrent_search import batch_search_and_match
from app.services.library_match_service import MatchConfig
from app.services.playlist_parser import parse_playlist_url
from app.services.navidrome_service import (
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
    navidrome_list_playlists,
    navidrome_get_playlist_songs,
)
from app.services.webhook_service import send_webhook_batch
from app.utils.text_normalizer import dedup_key

logger = logging.getLogger(__name__)


def _compute_songs_hash(songs: list[dict]) -> str:
    """Compute a deterministic hash of a song list for change detection."""
    normalized = sorted(
        [
            (s.get("title", "").strip().lower(), s.get("artist", "").strip().lower())
            for s in songs
        ],
        key=lambda x: (x[0], x[1]),
    )
    return hashlib.sha256(json.dumps(normalized, ensure_ascii=False).encode()).hexdigest()


async def run_incremental_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    Incremental playlist sync pipeline:
    1. Fetch current playlist songs from URL
    2. Compare with last sync hash — skip if unchanged
    3. Find new songs (not in last sync)
    4. Match and add only new songs to Navidrome playlist
    """
    logger.info(f"[playlist_incr] start run_id={run_id} url={url}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
        if not settings:
            raise RuntimeError("SystemSettings not initialized")

        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            await db.commit()

    last_hash = settings.playlist_sync_last_hash
    api_base = settings.playlist_api_url
    search_concurrency = max(1, min(20, int(getattr(settings, "search_concurrency", 5) or 5)))

    # Parse playlist
    try:
        parsed_name, platform, songs = await parse_playlist_url(url, api_base=api_base, timeout=float(settings.playlist_parse_timeout or 30))
    except Exception as e:
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = f"解析歌单失败: {e}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": 0, "error": str(e)}

    if not songs:
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = "歌单为空"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": 0, "error": "empty playlist"}

    # Compute current hash
    current_hash = _compute_songs_hash(songs)

    # Check if anything changed
    if current_hash == last_hash:
        logger.info(f"[playlist_incr] no changes detected, skipping sync run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "success"
                run_row.error_message = "歌单未变化，跳过同步"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": len(songs), "skipped": True, "reason": "unchanged"}

    final_name = (playlist_name and playlist_name.strip()) or parsed_name

    # Overwrite: delete existing playlist with same name from Navidrome
    if overwrite:
        all_pls = await navidrome_list_playlists()
        for pl in all_pls:
            if pl.get("name") == final_name and pl.get("id"):
                logger.info(f"[playlist_incr] overwriting playlist name={final_name} id={pl['id']}")
                await navidrome_delete_playlist(str(pl["id"]))
                break

    # Find existing songs in Navidrome playlist (for incremental detection)
    existing_song_ids: set[str] = set()
    if not overwrite:
        try:
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == final_name:
                    current_navidrome_playlist_id = str(pl["id"])
                    pl_songs = await navidrome_get_playlist_songs(current_navidrome_playlist_id)
                    existing_song_ids = {s["id"] for s in pl_songs if s.get("id")}
                    break
        except Exception as e:
            logger.warning(f"[playlist_incr] failed to get existing playlist songs: {e}")

    # All DB writes in ONE session
    async with AsyncSessionLocal() as db:
        playlist = GeneratedPlaylist(
            run_id=run_id,
            playlist_type="playlist_incremental",
            playlist_name=final_name,
            playlist_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            status="running",
        )
        db.add(playlist)
        await db.flush()

        matched_ids: list[str] = []
        new_songs_matched_count = 0
        missing_items: list[dict] = []

        async def _log_progress(done: int, total: int):
            if done % 20 == 0:
                logger.info(f"[playlist_incr] matching progress: {done}/{total}")

        match_cfg = MatchConfig(threshold=match_threshold, concurrency=search_concurrency)
        search_results = await batch_search_and_match(
            tracks=songs,
            config=match_cfg,
            progress_callback=_log_progress,
        )

        for idx, sr in enumerate(search_results):
            song = songs[idx]
            title = sr["title"]
            artist = sr["artist"]
            if not title or not artist:
                continue

            item = RecommendationItem(
                generated_playlist_id=playlist.id,
                title=title,
                artist=artist,
                album=song.get("album", ""),
                score=idx + 1,
                source_type="playlist_incremental",
                source_seed_name=title,
                source_seed_artist=artist,
                dedup_key=dedup_key(title, artist),
                rank_index=idx + 1,
            )
            db.add(item)
            await db.flush()

            best = sr.get("best_match")
            if best:
                # Incremental mode: only count "newly found" songs
                is_new = best["id"] not in existing_song_ids
                if is_new or overwrite:
                    matched_ids.append(best["id"])
                    new_songs_matched_count += 1

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
                missing_items.append(song)

        logger.info(
            f"[playlist_incr] done total={len(songs)} new_matched={new_songs_matched_count} "
            f"missing={len(missing_items)} hash_changed=True"
        )

        playlist.total_candidates = len(songs)
        playlist.matched_count = new_songs_matched_count
        playlist.missing_count = len(missing_items)

        # Add new songs to Navidrome playlist
        navidrome_playlist_id = None
        if matched_ids:
            # Get or create playlist
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    navidrome_playlist_id = str(pl["id"])
                    break
            if not navidrome_playlist_id:
                navidrome_playlist_id = await navidrome_create_playlist(final_name)

            if navidrome_playlist_id and matched_ids:
                ok = await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_ids)
                if ok:
                    playlist.navidrome_playlist_id = str(navidrome_playlist_id)
                else:
                    playlist.error_message = "Failed to add songs to Navidrome playlist"
                    playlist.status = "failed"
                    await db.commit()
                    return {"matched": 0, "new_added": 0, "missing": len(missing_items), "total": len(songs), "error": "Failed to add songs"}

        playlist.status = "success"
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)

        # Update last hash
        settings_result = await db.execute(select(SystemSettings))
        s = settings_result.scalar_one_or_none()
        if s:
            s.playlist_sync_last_hash = current_hash

        # Webhook for missing
        if missing_items and s and s.webhook_url and s.library_mode_default == "allow_missing":
            batch = WebhookBatch(
                run_id=run_id,
                playlist_type="playlist_incremental",
                status="pending",
                max_retry_count=s.webhook_retry_count or 3,
                payload_json=json.dumps({"items": missing_items}, ensure_ascii=False),
            )
            db.add(batch)
            await db.flush()
            for item_data in missing_items:
                text = (
                    f"{item_data.get('album', '')} - {item_data['artist']}"
                    if item_data.get("album")
                    else f"{item_data['title']} - {item_data['artist']}"
                )
                db.add(WebhookBatchItem(
                    batch_id=batch.id,
                    track=item_data["title"],
                    artist=item_data["artist"],
                    album=item_data.get("album"),
                    text=text,
                ))

        await db.commit()

    # Fire-and-forget webhook
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
        "new_added": new_songs_matched_count,
        "missing": len(missing_items),
        "total": len(songs),
        "hash_changed": True,
        "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
    }
