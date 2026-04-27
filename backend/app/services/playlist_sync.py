"""Third-party playlist sync pipeline — parse playlist URL and sync to Navidrome."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun, GeneratedPlaylist, RecommendationItem, NavidromeMatch
from app.services.playlist_parser import parse_playlist_url
from app.services.navidrome_service import (
    navidrome_multi_search,
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
)
from app.utils.text_normalizer import score_candidate, dedup_key

logger = logging.getLogger(__name__)


async def run_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    Main pipeline:
    1. Parse third-party playlist URL (NetEase / QQ / Qishui)
    2. For each track → multi-strategy Navidrome search
    3. Score & filter by threshold
    4. Create / overwrite Navidrome playlist
    5. Persist results in DB
    Returns summary dict.
    """
    logger.info(f"[playlist] start run_id={run_id} url={url}")

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
        # 1. Parse the third-party playlist
        try:
            api_base = settings.playlist_api_url if settings else None
            parsed_name, platform, songs = await parse_playlist_url(url, api_base=api_base)
        except Exception as e:
            async with AsyncSessionLocal() as db:
                run_row = await db.get(RecommendationRun, run_id)
                run_row.status = "failed"
                run_row.error_message = f"解析歌单失败: {e}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
            return {"matched": 0, "missing": 0, "total": 0, "error": str(e)}

        if not songs:
            async with AsyncSessionLocal() as db:
                run_row = await db.get(RecommendationRun, run_id)
                run_row.status = "failed"
                run_row.error_message = f"歌单为空或解析失败: {parsed_name}"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
            return {"matched": 0, "missing": 0, "total": 0, "error": "empty playlist"}

        # Resolve playlist name
        final_name = (playlist_name and playlist_name.strip()) or parsed_name

        # Overwrite: delete existing playlist with same name
        if overwrite:
            from app.services.navidrome_service import navidrome_list_playlists
            all_pls = await navidrome_list_playlists()
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    logger.info(f"[playlist] overwriting playlist name={final_name} id={pl['id']}")
                    await navidrome_delete_playlist(str(pl["id"]))
                    break

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
                best_match = _pick_best_match(title, artist, nav_results, match_threshold)

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
                        raw_response_json="",
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

            logger.info(
                f"[playlist] done total={len(songs)} "
                f"matched={len(matched_ids)} missing={len(missing_items)}"
            )

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
                        await db.commit()
                        async with AsyncSessionLocal() as db2:
                            row = await db2.get(RecommendationRun, run_id)
                            row.status = "failed"
                            row.error_message = "Failed to add songs to Navidrome playlist"
                            row.finished_at = datetime.now(timezone.utc)
                            await db2.commit()
                        return {
                            "matched": len(matched_ids),
                            "missing": len(missing_items),
                            "total": len(songs),
                            "error": "Failed to add songs",
                        }

            playlist.status = "success"
            await db.commit()

        async with AsyncSessionLocal() as db:
            row = await db.get(RecommendationRun, run_id)
            row.status = "success"
            row.finished_at = datetime.now(timezone.utc)
            await db.commit()

        # Webhook for missing items
        async with AsyncSessionLocal() as db:
            settings_result = await db.execute(select(SystemSettings))
            settings_loaded = settings_result.scalar_one_or_none()
        if missing_items and settings_loaded and settings_loaded.webhook_url and settings_loaded.library_mode_default == "allow_missing":
            async with AsyncSessionLocal() as db:
                from app.db.models import WebhookBatch, WebhookBatchItem
                import json as _json
                batch = WebhookBatch(
                    run_id=run_id,
                    playlist_type=f"playlist_{platform}",
                    status="pending",
                    max_retry_count=settings_loaded.webhook_retry_count or 3,
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
                from app.services.webhook_service import send_webhook_batch
                await send_webhook_batch(batch.id)

        return {
            "playlist_name": final_name,
            "platform": platform,
            "matched": len(matched_ids),
            "missing": len(missing_items),
            "total": len(songs),
            "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
        }

    except Exception as e:
        logger.exception(f"[playlist] run failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            row = await db.get(RecommendationRun, run_id)
            row.status = "failed"
            row.error_message = str(e)
            row.finished_at = datetime.now(timezone.utc)
            await db.commit()
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
