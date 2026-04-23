"""Recommendation service — core recommendation logic."""

import json
import logging
from datetime import datetime, timezone
from collections import defaultdict

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings, RecommendationRun, GeneratedPlaylist,
    RecommendationItem, NavidromeMatch, WebhookBatch, WebhookBatchItem,
)
from app.services.lastfm_service import (
    get_user_top_tracks, get_user_top_artists,
    get_similar_tracks, get_similar_artists, get_artist_top_tracks,
)
from app.services.navidrome_service import navidrome_search, navidrome_create_playlist, navidrome_add_to_playlist
from app.utils.text_normalizer import normalize_title, normalize_artist, dedup_key

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Entry points (called by tasks / routes)
# ─────────────────────────────────────────────

async def run_full_recommendation():
    """Run both playlist types as part of a single recommendation run."""
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="manual", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()  # 确保 run 写入 DB，后续 session 才能查到

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one()

        async with AsyncSessionLocal() as db:
            await _generate_similar_tracks(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            await _generate_similar_artists(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            await _cleanup_old_playlists(settings)

        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        logger.exception("Recommendation run failed")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "failed"
            run_row.error_message = str(e)
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def run_similar_tracks_only():
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="manual", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()  # 确保 run 写入 DB，后续 session 才能查到

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one()
        async with AsyncSessionLocal() as db:
            await _generate_similar_tracks(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        logger.exception("Similar tracks run failed")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "failed"
            run_row.error_message = str(e)
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def run_similar_artists_only():
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="manual", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()  # 确保 run 写入 DB，后续 session 才能查到

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one()
        async with AsyncSessionLocal() as db:
            await _generate_similar_artists(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        logger.exception("Similar artists run failed")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            run_row.status = "failed"
            run_row.error_message = str(e)
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


# ─────────────────────────────────────────────
# Similar Tracks pipeline
# ─────────────────────────────────────────────

async def _generate_similar_tracks(db: AsyncSession, run_id: int, settings):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    playlist_name = f"LastFM - 相似曲目 - {today}"

    playlist = GeneratedPlaylist(
        run_id=run_id,
        playlist_type="similar_tracks",
        playlist_name=playlist_name,
        playlist_date=today,
        status="running",
    )
    db.add(playlist)
    await db.flush()

    # 1. Get user top tracks as seeds
    seeds = await get_user_top_tracks(settings.lastfm_username, limit=settings.top_track_seed_limit)
    logger.info(f"[similar_tracks] Got {len(seeds)} seed tracks from Last.fm")

    candidates = []
    seen_keys = set()

    # balance: 0=conservative (fewer candidates), 100=exploratory (more candidates)
    balance = float(settings.recommendation_balance or 50) / 100.0
    # candidate pool multiplier: conservative=2x playlist_size, exploratory=10x
    candidate_pool_size = int(settings.similar_playlist_size * (2 + balance * 8))

    # 2. Fetch similar tracks for each seed (with deduplication across seeds)
    for seed in seeds[:settings.top_track_seed_limit]:
        seed_title = seed.get("name", "")
        seed_artist = seed.get("artist", {}).get("name", "") if isinstance(seed.get("artist"), dict) else (seed.get("artist", {}) or "")
        if not seed_title or not seed_artist:
            continue

        similar = await get_similar_tracks(seed_title, seed_artist, limit=settings.similar_track_limit)
        for track in similar:
            title = track.get("name", "")
            artist = track.get("artist", {}).get("name", "") if isinstance(track.get("artist"), dict) else ""
            if not title or not artist:
                continue

            score = float(track.get("match", 0))

            key = dedup_key(title, artist)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            candidates.append({
                "title": title,
                "artist": artist,
                "album": track.get("album", {}).get("#text", "") if isinstance(track.get("album"), dict) else "",
                "score": score,
                "source_type": "track_similarity",
                "source_seed_name": seed_title,
                "source_seed_artist": seed_artist,
                "dedup_key": key,
                "raw_payload_json": json.dumps(track),
            })

    # 3. Score aggregation — keep top N candidates before Navidrome matching
    candidates.sort(key=lambda x: x["score"], reverse=True)
    # Conservative: fewer candidates (lower score cutoff); Exploratory: more candidates
    candidates = candidates[:candidate_pool_size]

    # 4. Remove tracks recommended in the last `duplicate_avoid_days` days
    candidates = await _filter_recent(db, candidates, settings.duplicate_avoid_days)

    # 5. Navidrome matching
    matched_song_ids = []
    missing_items = []

    for idx, item_data in enumerate(candidates):
        match = await _match_to_navidrome(db, item_data)
        item = RecommendationItem(
            generated_playlist_id=playlist.id,
            title=item_data["title"],
            artist=item_data["artist"],
            album=item_data.get("album"),
            score=item_data["score"],
            source_type="track_similarity",
            source_seed_name=item_data["source_seed_name"],
            source_seed_artist=item_data["source_seed_artist"],
            dedup_key=item_data["dedup_key"],
            rank_index=idx + 1,
            raw_payload_json=item_data.get("raw_payload_json"),
        )
        db.add(item)
        await db.flush()

        if match and match.get("selected_song_id"):
            matched_song_ids.append(match["selected_song_id"])
            nm = NavidromeMatch(
                recommendation_item_id=item.id,
                matched=True,
                search_query=match.get("search_query"),
                selected_song_id=match["selected_song_id"],
                selected_title=match.get("selected_title"),
                selected_artist=match.get("selected_artist"),
                selected_album=match.get("selected_album"),
                confidence_score=match.get("confidence_score"),
                raw_response_json=json.dumps(match.get("raw_response")),
            )
        else:
            nm = NavidromeMatch(
                recommendation_item_id=item.id,
                matched=False,
                search_query=match.get("search_query") if match else None,
            )
            missing_items.append(item_data)
            # Save missing items to DB for visibility in history
            missing_item_db = RecommendationItem(
                generated_playlist_id=playlist.id,
                title=item_data["title"],
                artist=item_data["artist"],
                album=item_data.get("album"),
                score=item_data.get("score"),
                source_type=item_data.get("source_type"),
                source_seed_name=item_data.get("source_seed_name"),
                source_seed_artist=item_data.get("source_seed_artist"),
                dedup_key=item_data.get("dedup_key"),
            )
            db.add(missing_item_db)

        db.add(nm)

    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    # 6. Create Navidrome playlist
    navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
    if navidrome_playlist_id and matched_song_ids:
        await navidrome_add_to_playlist(navidrome_playlist_id, matched_song_ids)
        playlist.navidrome_playlist_id = str(navidrome_playlist_id)

    # 7. Webhook for missing items (if mode allows)
    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items)

    await db.commit()


# ─────────────────────────────────────────────
# Similar Artists pipeline
# ─────────────────────────────────────────────

async def _generate_similar_artists(db: AsyncSession, run_id: int, settings):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    playlist_name = f"LastFM - 相邻艺术家 - {today}"

    playlist = GeneratedPlaylist(
        run_id=run_id,
        playlist_type="similar_artists",
        playlist_name=playlist_name,
        playlist_date=today,
        status="running",
    )
    db.add(playlist)
    await db.flush()

    # 1. Get user top artists as seeds
    seed_artists = await get_user_top_artists(settings.lastfm_username, limit=settings.top_artist_seed_limit)
    logger.info(f"[similar_artists] Got {len(seed_artists)} seed artists from Last.fm")

    # dedup_key set across both playlists (for inter-playlist dedup)
    seen_keys = set()

    # Query existing dedup_keys from similar_tracks playlist created in this run
    # to enforce inter-playlist dedup
    existing_keys_result = await db.execute(
        select(RecommendationItem.dedup_key).join(GeneratedPlaylist)
        .where(GeneratedPlaylist.run_id == run_id)
        .where(GeneratedPlaylist.playlist_type == "similar_tracks")
    )
    for row in existing_keys_result:
        if row[0]:
            seen_keys.add(row[0])

    candidates = []

    for seed in seed_artists[:settings.top_artist_seed_limit]:
        seed_name = seed.get("name", "")
        if not seed_name:
            continue

        similar = await get_similar_artists(seed_name, limit=settings.similar_artist_limit)
        for artist in similar[:5]:  # top 5 similar artists per seed
            artist_name = artist.get("name", "")
            if not artist_name:
                continue

            # artist.getSimilar 返回 match 字段（0~1），用作权重
            artist_match = float(artist.get("match", 0.0))

            tracks = await get_artist_top_tracks(artist_name, limit=settings.artist_top_track_limit)
            for track in tracks:
                title = track.get("name", "")
                if not title:
                    continue

                # Use artist from API (may differ from seed artist_name)
                track_artist = track.get("artist", {}).get("name", "") if isinstance(track.get("artist"), dict) else ""
                album = track.get("album", {}).get("#text", "") if isinstance(track.get("album"), dict) else ""

                key = dedup_key(title, track_artist)
                if key in seen_keys:
                    continue
                seen_keys.add(key)

                # score = artist_match 权重 * track 基础分
                candidates.append({
                    "title": title,
                    "artist": track_artist,
                    "album": album,
                    "score": artist_match,
                    "source_type": "artist_similarity",
                    "source_seed_name": seed_name,
                    "source_seed_artist": artist_name,
                    "dedup_key": key,
                    "raw_payload_json": json.dumps(track),
                })

    # Sort by score then limit
    candidates.sort(key=lambda x: x["score"], reverse=True)
    candidates = candidates[:settings.artist_playlist_size]

    # Filter recent
    candidates = await _filter_recent(db, candidates, settings.duplicate_avoid_days)

    matched_song_ids = []
    missing_items = []

    for idx, item_data in enumerate(candidates):
        match = await _match_to_navidrome(db, item_data)
        item = RecommendationItem(
            generated_playlist_id=playlist.id,
            title=item_data["title"],
            artist=item_data["artist"],
            album=item_data.get("album"),
            score=item_data["score"],
            source_type="artist_similarity",
            source_seed_name=item_data["source_seed_name"],
            source_seed_artist=item_data["source_seed_artist"],
            dedup_key=item_data["dedup_key"],
            rank_index=idx + 1,
            raw_payload_json=item_data.get("raw_payload_json"),
        )
        db.add(item)
        await db.flush()

        if match and match.get("selected_song_id"):
            matched_song_ids.append(match["selected_song_id"])
            nm = NavidromeMatch(
                recommendation_item_id=item.id,
                matched=True,
                search_query=match.get("search_query"),
                selected_song_id=match["selected_song_id"],
                selected_title=match.get("selected_title"),
                selected_artist=match.get("selected_artist"),
                selected_album=match.get("selected_album"),
                confidence_score=match.get("confidence_score"),
                raw_response_json=json.dumps(match.get("raw_response")),
            )
        else:
            nm = NavidromeMatch(
                recommendation_item_id=item.id,
                matched=False,
                search_query=match.get("search_query") if match else None,
            )
            missing_items.append(item_data)
            missing_item_db = RecommendationItem(
                generated_playlist_id=playlist.id,
                title=item_data["title"],
                artist=item_data["artist"],
                album=item_data.get("album"),
                score=item_data.get("score"),
                source_type=item_data.get("source_type"),
                source_seed_name=item_data.get("source_seed_name"),
                source_seed_artist=item_data.get("source_seed_artist"),
                dedup_key=item_data.get("dedup_key"),
            )
            db.add(missing_item_db)

        db.add(nm)

    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
    if navidrome_playlist_id and matched_song_ids:
        await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_song_ids)
        playlist.navidrome_playlist_id = str(navidrome_playlist_id)

    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items)

    await db.commit()


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def _filter_recent(db: AsyncSession, candidates: list[dict], avoid_days: int) -> list[dict]:
    """Remove candidates that were recommended within the last `avoid_days` days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=avoid_days)

    result = await db.execute(
        select(RecommendationItem.dedup_key)
        .join(GeneratedPlaylist)
        .where(RecommendationItem.created_at >= cutoff)
    )
    recent_keys = {row[0] for row in result if row[0]}

    return [c for c in candidates if c["dedup_key"] not in recent_keys]


async def _match_to_navidrome(db: AsyncSession, item_data: dict) -> dict | None:
    """Search Navidrome for a track and return best match."""
    logger = logging.getLogger(__name__)
    from app.utils.text_normalizer import normalize_title, normalize_artist
    query_raw = f"{item_data['title']} {item_data['artist']}"
    query_norm = f"{normalize_title(item_data['title'])} {normalize_artist(item_data['artist'])}"
    results = await navidrome_search(query_norm, limit=10)  # normalized first for better recall
    if not results:
        logger.warning(f"[match] no search results for query: {query}")
        return None

    # Score each result by title + artist similarity
    from rapidfuzz import fuzz
    best = None
    best_score = 0
    norm_title = normalize_title(item_data["title"])
    norm_artist = normalize_artist(item_data["artist"])
    for r in results:
        r_title = r.get("title") or ""
        r_artist = r.get("artist") or ""
        # token_sort_ratio is better for titles with word order variations
        title_score = fuzz.token_sort_ratio(norm_title, normalize_title(r_title))
        artist_score = fuzz.token_set_ratio(norm_artist, normalize_artist(r_artist))
        combined = (title_score * 0.6 + artist_score * 0.4) / 100
        if combined > best_score:
            best_score = combined
            best = r
    logger.info(f"[match] raw_query={query_raw} norm_query={query_norm} results={len(results)} best_score={best_score:.3f} best_title={best.get('title') if best else None}")

    if best and best_score > 0.15:
        return {
            "selected_song_id": best.get("id") or best.get("songId"),
            "selected_title": best.get("title"),
            "selected_artist": best.get("artist"),
            "selected_album": best.get("album"),
            "confidence_score": best_score,
            "search_query": query,
            "raw_response": best,
        }
    return {"search_query": query}


async def _create_webhook_batch(db: AsyncSession, run_id: int, playlist, missing_items: list[dict]):
    """Create a webhook batch for missing items."""
    batch = WebhookBatch(
        run_id=run_id,
        playlist_type=playlist.playlist_type,
        status="pending",
        max_retry_count=3,
    )
    db.add(batch)
    await db.flush()

    for item_data in missing_items:
        text = f"{item_data.get('album', '')} - {item_data['artist']}" if item_data.get("album") else f"{item_data['title']} - {item_data['artist']}"
        batch_item = WebhookBatchItem(
            batch_id=batch.id,
            track=item_data["title"],
            artist=item_data["artist"],
            album=item_data.get("album"),
            text=text,
        )
        db.add(batch_item)

    await db.commit()

    # Fire-and-forget webhook send
    from app.services.webhook_service import send_webhook_batch
    await send_webhook_batch(batch.id)


async def _cleanup_old_playlists(settings: SystemSettings):
    """Delete Navidrome playlists with the LastFM prefix older than keep_days."""
    from datetime import timedelta
    from app.services.navidrome_service import navidrome_list_playlists, navidrome_delete_playlist

    keep_date = datetime.now(timezone.utc) - timedelta(days=settings.playlist_keep_days)

    all_playlists = await navidrome_list_playlists()
    for pl in all_playlists:
        name = pl.get("name", "")
        if not (name.startswith("LastFM - 相似曲目 -") or name.startswith("LastFM - 相邻艺术家 -")):
            continue
        # Extract date from name: "LastFM - 相似曲目 - 2026-04-22"
        date_str = name.split(" - ")[-1]
        try:
            playlist_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if playlist_date < keep_date:
            logger.info(f"Deleting old playlist: {name}")
            await navidrome_delete_playlist(pl.get("id"))