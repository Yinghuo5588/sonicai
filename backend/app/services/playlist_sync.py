"""Third-party playlist sync pipeline — parse playlist URL and sync to Navidrome."""

import logging
import json as _json
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings, RecommendationRun, GeneratedPlaylist,
    RecommendationItem, NavidromeMatch, WebhookBatch, WebhookBatchItem,
)
from app.services.playlist_parser import parse_playlist_url
from app.services.navidrome_service import (
    navidrome_multi_search,
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
    navidrome_list_playlists,
)
from app.services.matching_service import pick_best_match
from app.utils.text_normalizer import dedup_key
from app.services.webhook_service import send_webhook_batch

logger = logging.getLogger(__name__)


async def run_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """URL-based playlist sync pipeline."""
    logger.info(f"[playlist] start run_id={run_id} url={url}")

    # Load settings snapshot
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
        settings_snapshot = {
            "playlist_api_url": settings.playlist_api_url,
            "webhook_url": settings.webhook_url,
            "webhook_retry_count": settings.webhook_retry_count,
            "library_mode_default": settings.library_mode_default,
        }

    try:
        parsed_name, platform, songs = await parse_playlist_url(url, api_base=settings_snapshot["playlist_api_url"])
    except Exception as e:
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = f"解析歌单失败: {e}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": 0, "error": str(e)}

    return await _run_sync_pipeline(
        run_id=run_id,
        parsed_name=parsed_name,
        platform=platform,
        songs=songs,
        match_threshold=match_threshold,
        playlist_name=playlist_name,
        overwrite=overwrite,
        settings=settings_snapshot,
    )


async def run_text_sync(
    run_id: int,
    text_content: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """Text-file based playlist sync — parse plain text and run the full sync pipeline."""
    from app.services.playlist_parser import parse_text_songs
    logger.info(f"[text_sync] start run_id={run_id}, chars={len(text_content)}")

    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if not run_row:
            raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")
        run_row.status = "running"
        run_row.started_at = datetime.now(timezone.utc)
        await db.commit()

    parsed_name, platform, songs = parse_text_songs(text_content)

    if not songs:
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = "文本内容为空或解析失败"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": 0, "error": "empty text"}

    # Load settings snapshot
    settings_snapshot: dict = {}
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        s = result.scalar_one_or_none()
        if s:
            settings_snapshot = {
                "webhook_url": s.webhook_url,
                "webhook_retry_count": s.webhook_retry_count,
                "library_mode_default": s.library_mode_default,
            }

    return await _run_sync_pipeline(
        run_id=run_id,
        parsed_name=parsed_name,
        platform=platform,
        songs=songs,
        match_threshold=match_threshold,
        playlist_name=playlist_name,
        overwrite=overwrite,
        settings=settings_snapshot,
    )


async def _run_sync_pipeline(
    run_id: int,
    parsed_name: str,
    platform: str,
    songs: list[dict],
    match_threshold: float,
    playlist_name: str | None,
    overwrite: bool,
    settings: dict | None = None,
) -> dict:
    """Shared pipeline — single DB session for all writes."""
    if not songs:
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = f"歌单为空: {parsed_name}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return {"matched": 0, "missing": 0, "total": 0, "error": "empty playlist"}

    final_name = (playlist_name and playlist_name.strip()) or parsed_name

    # Overwrite: delete existing playlist with same name from Navidrome
    if overwrite:
        all_pls = await navidrome_list_playlists()
        for pl in all_pls:
            if pl.get("name") == final_name and pl.get("id"):
                logger.info(f"[playlist] overwriting playlist name={final_name} id={pl['id']}")
                await navidrome_delete_playlist(str(pl["id"]))
                break

    # Single DB session for all writes
    async with AsyncSessionLocal() as db:
        playlist = GeneratedPlaylist(
            run_id=run_id,
            playlist_type=f"playlist_{platform}",
            playlist_name=final_name,
            playlist_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            status="running",
        )
        db.add(playlist)
        await db.flush()

        matched_ids: list[str] = []
        missing_items: list[dict] = []

        for idx, song in enumerate(songs):
            title = song.get("title", "")
            artist = song.get("artist", "")
            if not title or not artist:
                continue

            nav_results = await navidrome_multi_search(title, artist)
            best_match = pick_best_match(title, artist, nav_results, match_threshold)

            item = RecommendationItem(
                generated_playlist_id=playlist.id,
                title=title,
                artist=artist,
                album=song.get("album", ""),
                score=idx + 1,
                source_type=f"playlist_{platform}",
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
                ))
            else:
                db.add(NavidromeMatch(
                    recommendation_item_id=item.id,
                    matched=False,
                    search_query=f"{title} {artist}",
                ))
                missing_items.append(song)

            if (idx + 1) % 20 == 0:
                logger.info(f"[playlist] matching progress: {idx+1}/{len(songs)}")

        logger.info(f"[playlist] done total={len(songs)} matched={len(matched_ids)} missing={len(missing_items)}")

        playlist.total_candidates = len(songs)
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
                    run_row = await db.get(RecommendationRun, run_id)
                    if run_row:
                        run_row.status = "failed"
                        run_row.error_message = "Failed to add songs to Navidrome playlist"
                        run_row.finished_at = datetime.now(timezone.utc)
                    await db.commit()
                    return {"matched": len(matched_ids), "missing": len(missing_items), "total": len(songs), "error": "Failed to add songs"}

        playlist.status = "success"
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)

        # Webhook for missing items
        if missing_items and settings and settings.get("webhook_url") and settings.get("library_mode_default") == "allow_missing":
            batch = WebhookBatch(
                run_id=run_id,
                playlist_type=f"playlist_{platform}",
                status="pending",
                max_retry_count=settings.get("webhook_retry_count") or 3,
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
    if missing_items and settings and settings.get("webhook_url") and settings.get("library_mode_default") == "allow_missing":
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WebhookBatch).where(WebhookBatch.run_id == run_id).order_by(WebhookBatch.id.desc())
            )
            batch = result.scalar_one_or_none()
            if batch:
                await send_webhook_batch(batch.id)

    return {
        "playlist_name": final_name,
        "platform": platform,
        "matched": len(matched_ids),
        "missing": len(missing_items),
        "total": len(songs),
        "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
    }
