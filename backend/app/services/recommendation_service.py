"""Recommendation service — core recommendation logic."""

import json
import logging
from datetime import datetime, timezone
from collections import defaultdict
import asyncio

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings, RecommendationRun, GeneratedPlaylist,
    RecommendationItem, NavidromeMatch, WebhookBatch, WebhookBatchItem,
)
from app.services.lastfm_service import (
    get_user_top_tracks, get_user_top_artists, get_user_recent_tracks,
    get_similar_tracks, get_similar_artists, get_artist_top_tracks,
)
from app.services.navidrome_service import navidrome_search, navidrome_create_playlist, navidrome_add_to_playlist, navidrome_delete_playlist
from app.utils.text_normalizer import dedup_key

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Stop flag registry (run_id -> asyncio.Event)
# ─────────────────────────────────────────────

_stop_events: dict[int, asyncio.Event] = {}


def stop_run(run_id: int) -> bool:
    """Signal a running job to stop. Returns True if a job was found."""
    event = _stop_events.get(run_id)
    if event is not None:
        event.set()
        logger.info(f"[stop] signaled stop for run_id={run_id}")
        return True
    return False


async def _is_run_stopped(run_id: int, db: AsyncSession) -> bool:
    """Check if a run has been asked to stop (checks both Event and DB status)."""
    if run_id in _stop_events and _stop_events[run_id].is_set():
        return True
    result = await db.execute(select(RecommendationRun.status).where(RecommendationRun.id == run_id))
    row = result.scalar_one_or_none()
    return row == "stopped"


# ─────────────────────────────────────────────
# Entry points (called by tasks / routes)
# ─────────────────────────────────────────────

async def run_full_recommendation(run_id: int, trigger_type: str = "manual"):
    """Run both playlist types as part of a single recommendation run."""
    import json
    logger.info(f"[run] start run_type=full trigger_type={trigger_type} run_id={run_id}")
    _stop_events[run_id] = asyncio.Event()
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()
            if not settings:
                raise RuntimeError("SystemSettings not initialized")
            snapshot = {
                "timezone": settings.timezone,
                "lastfm_username": settings.lastfm_username,
                "library_mode_default": settings.library_mode_default,
                "duplicate_avoid_days": settings.duplicate_avoid_days,
                "top_track_seed_limit": settings.top_track_seed_limit,
                "top_artist_seed_limit": settings.top_artist_seed_limit,
                "similar_track_limit": settings.similar_track_limit,
                "similar_artist_limit": settings.similar_artist_limit,
                "artist_top_track_limit": settings.artist_top_track_limit,
                "similar_playlist_size": settings.similar_playlist_size,
                "artist_playlist_size": settings.artist_playlist_size,
                "recommendation_balance": settings.recommendation_balance,
                "seed_source_mode": settings.seed_source_mode,
                "recent_tracks_limit": settings.recent_tracks_limit,
                "top_period": settings.top_period,
                "recent_top_mix_ratio": settings.recent_top_mix_ratio,
                "match_threshold": float(settings.match_threshold) if settings.match_threshold is not None else None,
                "candidate_pool_multiplier_min": float(settings.candidate_pool_multiplier_min) if settings.candidate_pool_multiplier_min is not None else None,
                "candidate_pool_multiplier_max": float(settings.candidate_pool_multiplier_max) if settings.candidate_pool_multiplier_max is not None else None,
            }
            run_row = await db.get(RecommendationRun, run_id)
            if not run_row:
                raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            run_row.config_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
            await db.commit()

        async with AsyncSessionLocal() as db:
            if await _is_run_stopped(run_id, db):
                raise InterruptedError("Job stopped by user")
            await _generate_similar_tracks(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            if await _is_run_stopped(run_id, db):
                raise InterruptedError("Job stopped by user")
            await _generate_similar_artists(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            await _cleanup_old_playlists(settings)
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row and run_row.status == "running":
                run_row.status = "success"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except (asyncio.CancelledError, InterruptedError) as e:
        logger.info(f"[run] run_id={run_id} stopped by user: {e}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "stopped"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except Exception as e:
        logger.exception(f"[run] full run failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = str(e)
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    finally:
        _stop_events.pop(run_id, None)


async def run_similar_tracks_only(run_id: int, trigger_type: str = "manual"):
    import json
    logger.info(f"[run] start run_type=similar_tracks trigger_type={trigger_type} run_id={run_id}")
    _stop_events[run_id] = asyncio.Event()
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()
            if not settings:
                raise RuntimeError("SystemSettings not initialized")
            snapshot = {
                "timezone": settings.timezone,
                "lastfm_username": settings.lastfm_username,
                "library_mode_default": settings.library_mode_default,
                "duplicate_avoid_days": settings.duplicate_avoid_days,
                "top_track_seed_limit": settings.top_track_seed_limit,
                "similar_track_limit": settings.similar_track_limit,
                "similar_playlist_size": settings.similar_playlist_size,
                "recommendation_balance": settings.recommendation_balance,
                "seed_source_mode": settings.seed_source_mode,
                "recent_tracks_limit": settings.recent_tracks_limit,
                "top_period": settings.top_period,
                "recent_top_mix_ratio": settings.recent_top_mix_ratio,
                "match_threshold": float(settings.match_threshold) if settings.match_threshold is not None else None,
                "candidate_pool_multiplier_min": float(settings.candidate_pool_multiplier_min) if settings.candidate_pool_multiplier_min is not None else None,
                "candidate_pool_multiplier_max": float(settings.candidate_pool_multiplier_max) if settings.candidate_pool_multiplier_max is not None else None,
            }
            run_row = await db.get(RecommendationRun, run_id)
            if not run_row:
                raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            run_row.config_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
            await db.commit()
        async with AsyncSessionLocal() as db:
            if await _is_run_stopped(run_id, db):
                raise InterruptedError("Job stopped by user")
            await _generate_similar_tracks(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row and run_row.status == "running":
                run_row.status = "success"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except (asyncio.CancelledError, InterruptedError) as e:
        logger.info(f"[run] run_id={run_id} stopped by user: {e}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "stopped"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except Exception as e:
        logger.exception(f"[run] similar_tracks failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = str(e)
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    finally:
        _stop_events.pop(run_id, None)


async def run_similar_artists_only(run_id: int, trigger_type: str = "manual"):
    import json
    logger.info(f"[run] start run_type=similar_artists trigger_type={trigger_type} run_id={run_id}")
    _stop_events[run_id] = asyncio.Event()
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()
            if not settings:
                raise RuntimeError("SystemSettings not initialized")
            snapshot = {
                "timezone": settings.timezone,
                "lastfm_username": settings.lastfm_username,
                "library_mode_default": settings.library_mode_default,
                "duplicate_avoid_days": settings.duplicate_avoid_days,
                "top_artist_seed_limit": settings.top_artist_seed_limit,
                "similar_artist_limit": settings.similar_artist_limit,
                "artist_top_track_limit": settings.artist_top_track_limit,
                "artist_playlist_size": settings.artist_playlist_size,
                "recommendation_balance": settings.recommendation_balance,
                "seed_source_mode": settings.seed_source_mode,
                "recent_tracks_limit": settings.recent_tracks_limit,
                "top_period": settings.top_period,
                "recent_top_mix_ratio": settings.recent_top_mix_ratio,
                "match_threshold": float(settings.match_threshold) if settings.match_threshold is not None else None,
            }
            run_row = await db.get(RecommendationRun, run_id)
            if not run_row:
                raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            run_row.config_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
            await db.commit()
        async with AsyncSessionLocal() as db:
            if await _is_run_stopped(run_id, db):
                raise InterruptedError("Job stopped by user")
            await _generate_similar_artists(db, run_id, settings)
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row and run_row.status == "running":
                run_row.status = "success"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except (asyncio.CancelledError, InterruptedError) as e:
        logger.info(f"[run] run_id={run_id} stopped by user: {e}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "stopped"
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    except Exception as e:
        logger.exception(f"[run] similar_artists failed run_id={run_id}")
        async with AsyncSessionLocal() as db:
            run_row = await db.get(RecommendationRun, run_id)
            if run_row:
                run_row.status = "failed"
                run_row.error_message = str(e)
                run_row.finished_at = datetime.now(timezone.utc)
                await db.commit()
    finally:
        _stop_events.pop(run_id, None)


async def _generate_similar_tracks(db: AsyncSession, run_id: int, settings):
    logger.info(
        f"[similar_tracks] seed_source_mode={getattr(settings, 'seed_source_mode', 'recent_plus_top')} "
        f"recent_tracks_limit={getattr(settings, 'recent_tracks_limit', 100)} "
        f"duplicate_avoid_days={settings.duplicate_avoid_days} balance={settings.recommendation_balance}"
    )

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

    seed_mode = getattr(settings, 'seed_source_mode', 'recent_plus_top') or 'recent_plus_top'
    seed_limit = settings.top_track_seed_limit or 8

    if seed_mode == 'recent_only':
        recent_limit = getattr(settings, 'recent_tracks_limit', 100) or 100
        recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=recent_limit)
        recent_counter: dict = {}
        for t in recent_tracks:
            title = t.get("name", "")
            artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
            if title and artist:
                key = (title.lower(), artist.lower())
                recent_counter[key] = recent_counter.get(key, 0) + 1
        sorted_recent = sorted(recent_counter.items(), key=lambda x: x[1], reverse=True)
        seeds = [{"name": k[0], "artist": {"name": k[1]}, "play_count": v} for k, v in sorted_recent[:seed_limit]]
    elif seed_mode == 'top_only':
        period = getattr(settings, 'top_period', '1month') or '1month'
        top_tracks = await get_user_top_tracks(settings.lastfm_username, limit=seed_limit, period=period)
        seeds = [t for t in top_tracks if t.get("name") and t.get("artist")]
    else:
        recent_limit = getattr(settings, 'recent_tracks_limit', 100) or 100
        recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=recent_limit)
        recent_counter: dict = {}
        for t in recent_tracks:
            title = t.get("name", "")
            artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
            if title and artist:
                key = (title.lower(), artist.lower())
                recent_counter[key] = recent_counter.get(key, 0) + 1
        sorted_recent = sorted(recent_counter.items(), key=lambda x: x[1], reverse=True)
        recent_ratio = (getattr(settings, 'recent_top_mix_ratio', 70) or 70) / 100.0
        target_recent = int(seed_limit * recent_ratio)
        recent_seeds = [{"name": k[0], "artist": {"name": k[1]}, "play_count": v} for k, v in sorted_recent[:target_recent]]
        remaining = seed_limit - len(recent_seeds)
        seeds = list(recent_seeds)
        if remaining > 0:
            period = getattr(settings, 'top_period', '1month') or '1month'
            top_tracks = await get_user_top_tracks(settings.lastfm_username, limit=seed_limit, period=period)
            existing_keys = {(s["name"].lower(), s["artist"]["name"].lower() if isinstance(s["artist"], dict) else "") for s in recent_seeds}
            for t in top_tracks:
                title = t.get("name", "")
                artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else ""
                if title and artist and (title.lower(), artist.lower()) not in existing_keys:
                    seeds.append(t)
                    existing_keys.add((title.lower(), artist.lower()))
                if len(seeds) >= seed_limit:
                    break

    logger.info(f"[similar_tracks] seeds: {len(seeds)}")

    candidates = []
    seen_keys = set()

    balance = float(settings.recommendation_balance or 55) / 100.0
    min_mult = float(getattr(settings, 'candidate_pool_multiplier_min', 2.0) or 2.0)
    max_mult = float(getattr(settings, 'candidate_pool_multiplier_max', 10.0) or 10.0)
    candidate_pool_size = int(settings.similar_playlist_size * (min_mult + balance * (max_mult - min_mult)))

    for seed in seeds[:settings.top_track_seed_limit]:
        seed_title = seed.get("name", "")
        seed_artist = seed.get("artist", {}).get("name", "") if isinstance(seed.get("artist"), dict) else (seed.get("artist", {}) or "")
        if not seed_title or not seed_artist:
            continue
        if await _is_run_stopped(run_id, db):
            logger.info(f"[similar_tracks] run_id={run_id} stopped, aborting")
            return
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

    candidates.sort(key=lambda x: x["score"], reverse=True)
    candidates = candidates[:candidate_pool_size]
    logger.info(f"[similar_tracks] candidates after pool: {len(candidates)}, pool_size={candidate_pool_size}")

    if await _is_run_stopped(run_id, db):
        logger.info(f"[similar_tracks] run_id={run_id} stopped, aborting")
        return
    candidates = await _filter_recent(db, candidates, settings.duplicate_avoid_days)
    logger.info(f"[similar_tracks] candidates after recent filter: {len(candidates)}")

    matched_song_ids = []
    missing_items = []

    for idx, item_data in enumerate(candidates):
        if await _is_run_stopped(run_id, db):
            logger.info(f"[similar_tracks] run_id={run_id} stopped at item {idx+1}/{len(candidates)}")
            return
        match = await _match_to_navidrome(db, item_data, settings)
        if idx % 50 == 0:
            logger.info(f"[similar_tracks] Navidrome progress: {idx+1}/{len(candidates)}")
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
            db.add(NavidromeMatch(
                recommendation_item_id=item.id, matched=True, search_query=match.get("search_query"),
                selected_song_id=match["selected_song_id"], selected_title=match.get("selected_title"),
                selected_artist=match.get("selected_artist"), selected_album=match.get("selected_album"),
                confidence_score=match.get("confidence_score"),
                raw_response_json=json.dumps(match.get("raw_response")),
            ))
        else:
            db.add(NavidromeMatch(
                recommendation_item_id=item.id, matched=False,
                search_query=match.get("search_query") if match else None,
            ))
            missing_items.append(item_data)

    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    if matched_song_ids:
        navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
        if navidrome_playlist_id:
            try:
                await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_song_ids)
                playlist.navidrome_playlist_id = str(navidrome_playlist_id)
            except Exception as e:
                logger.error(f"[playlist] failed to add songs: {e}")
                await navidrome_delete_playlist(str(navidrome_playlist_id))
                playlist.status = "failed"
                playlist.error_message = f"Failed to add songs: {e}"
                await db.commit()
                return
    else:
        logger.warning(f"[playlist] no matched songs, skipping Navidrome playlist creation")

    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items, settings)

    await db.commit()


async def _generate_similar_artists(db: AsyncSession, run_id: int, settings):
    logger.info(f"[similar_artists] duplicate_avoid_days={settings.duplicate_avoid_days} balance={settings.recommendation_balance}")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    playlist_name = f"LastFM - 相似艺术家 - {today}"

    playlist = GeneratedPlaylist(
        run_id=run_id,
        playlist_type="similar_artists",
        playlist_name=playlist_name,
        playlist_date=today,
        status="running",
    )
    db.add(playlist)
    await db.flush()

    recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=100)
    artist_counter: dict = {}
    for t in recent_tracks:
        artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
        if artist:
            artist_counter[artist.lower()] = artist_counter.get(artist.lower(), 0) + 1

    sorted_recent_artists = sorted(artist_counter.items(), key=lambda x: x[1], reverse=True)
    recent_seed_artists = [{"name": a[0].title(), "play_count": a[1]} for a in sorted_recent_artists[:settings.top_artist_seed_limit]]

    if len(recent_seed_artists) < settings.top_artist_seed_limit:
        period = getattr(settings, 'top_period', '1month') or '1month'
        top_artists = await get_user_top_artists(settings.lastfm_username, limit=settings.top_artist_seed_limit, period=period)
        existing = {a["name"].lower() for a in recent_seed_artists}
        for a in top_artists:
            name = a.get("name", "")
            if name and name.lower() not in existing:
                recent_seed_artists.append(a)
                existing.add(name.lower())
            if len(recent_seed_artists) >= settings.top_artist_seed_limit:
                break

    seed_artists = recent_seed_artists
    logger.info(f"[similar_artists] seeds: {len(seed_artists)}")

    seen_keys = set()
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
        if await _is_run_stopped(run_id, db):
            logger.info(f"[similar_artists] run_id={run_id} stopped, aborting")
            return

        similar_artist_limit = int(settings.similar_artist_limit or 30)
        similar = await get_similar_artists(seed_name, limit=similar_artist_limit)

        for artist in similar[:similar_artist_limit]:
            artist_name = artist.get("name", "")
            if not artist_name:
                continue
            artist_match = float(artist.get("match", 0.0))
            tracks = await get_artist_top_tracks(artist_name, limit=settings.artist_top_track_limit)
            for track in tracks:
                title = track.get("name", "")
                if not title:
                    continue
                track_artist = track.get("artist", {}).get("name", "") if isinstance(track.get("artist"), dict) else ""
                album = track.get("album", {}).get("#text", "") if isinstance(track.get("album"), dict) else ""
                key = dedup_key(title, track_artist)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                candidates.append({
                    "title": title, "artist": track_artist, "album": album,
                    "score": artist_match, "source_type": "artist_similarity",
                    "source_seed_name": seed_name, "source_seed_artist": artist_name,
                    "dedup_key": key, "raw_payload_json": json.dumps(track),
                })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    candidates = candidates[:settings.artist_playlist_size]

    if await _is_run_stopped(run_id, db):
        logger.info(f"[similar_artists] run_id={run_id} stopped, aborting")
        return
    candidates = await _filter_recent(db, candidates, settings.duplicate_avoid_days)

    matched_song_ids = []
    missing_items = []

    for idx, item_data in enumerate(candidates):
        if await _is_run_stopped(run_id, db):
            logger.info(f"[similar_artists] run_id={run_id} stopped at item {idx+1}/{len(candidates)}")
            return
        match = await _match_to_navidrome(db, item_data, settings)
        if idx % 50 == 0:
            logger.info(f"[similar_artists] Navidrome progress: {idx+1}/{len(candidates)}")
        item = RecommendationItem(
            generated_playlist_id=playlist.id,
            title=item_data["title"], artist=item_data["artist"], album=item_data.get("album"),
            score=item_data["score"], source_type="artist_similarity",
            source_seed_name=item_data["source_seed_name"], source_seed_artist=item_data["source_seed_artist"],
            dedup_key=item_data["dedup_key"], rank_index=idx + 1,
            raw_payload_json=item_data.get("raw_payload_json"),
        )
        db.add(item)
        await db.flush()
        if match and match.get("selected_song_id"):
            matched_song_ids.append(match["selected_song_id"])
            db.add(NavidromeMatch(
                recommendation_item_id=item.id, matched=True, search_query=match.get("search_query"),
                selected_song_id=match["selected_song_id"], selected_title=match.get("selected_title"),
                selected_artist=match.get("selected_artist"), selected_album=match.get("selected_album"),
                confidence_score=match.get("confidence_score"),
                raw_response_json=json.dumps(match.get("raw_response")),
            ))
        else:
            db.add(NavidromeMatch(
                recommendation_item_id=item.id, matched=False,
                search_query=match.get("search_query") if match else None,
            ))
            missing_items.append(item_data)

    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    logger.info(f"[playlist] ready type=similar_artists matched={len(matched_song_ids)} missing={len(missing_items)}")

    navidrome_playlist_id = None
    if matched_song_ids:
        navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
    if navidrome_playlist_id and matched_song_ids:
        try:
            await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_song_ids)
            playlist.navidrome_playlist_id = str(navidrome_playlist_id)
        except Exception as e:
            logger.error(f"[playlist] failed to add songs: {e}")
            await navidrome_delete_playlist(str(navidrome_playlist_id))
            playlist.status = "failed"
            playlist.error_message = f"Failed to add songs: {e}"
            await db.commit()
            return

    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items, settings)

    await db.commit()


async def _filter_recent(db: AsyncSession, candidates: list[dict], avoid_days: int) -> list[dict]:
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=avoid_days)
    result = await db.execute(
        select(RecommendationItem.dedup_key)
        .join(GeneratedPlaylist)
        .where(RecommendationItem.created_at >= cutoff)
    )
    recent_keys = {row[0] for row in result if row[0]}
    original_count = len(candidates)
    filtered = [c for c in candidates if c["dedup_key"] not in recent_keys]
    logger.info(f"[filter-recent] avoid_days={avoid_days} input={original_count} output={len(filtered)} filtered={original_count - len(filtered)}")
    return filtered


async def _match_to_navidrome(db: AsyncSession, item_data: dict, settings) -> dict | None:
    """
    Match recommendation item through the unified library matching pipeline
    using MatchConfig from SystemSettings.
    """
    from app.services.library_match_service import MatchConfig, match_track

    threshold = float(settings.match_threshold) if settings.match_threshold is not None else 0.75
    cfg = MatchConfig(
        threshold=threshold,
        concurrency=max(1, min(20, int(settings.search_concurrency or 5))),
    )

    best = await match_track(
        title=item_data["title"],
        artist=item_data["artist"],
        threshold=cfg.threshold,
    )

    if not best:
        return None

    return {
        "selected_song_id": best.get("id"),
        "selected_title": best.get("title"),
        "selected_artist": best.get("artist"),
        "selected_album": best.get("album"),
        "confidence_score": best.get("score"),
        "title_score": best.get("title_score"),
        "artist_score": best.get("artist_score"),
        "search_query": f"{title} {artist}",
        "raw_response": best,
    }


async def _create_webhook_batch(db: AsyncSession, run_id: int, playlist, missing_items: list[dict], settings=None):
    max_retry = settings.webhook_retry_count if settings else 3
    batch = WebhookBatch(
        run_id=run_id, playlist_type=playlist.playlist_type,
        status="pending", max_retry_count=max_retry,
    )
    db.add(batch)
    await db.flush()
    for item_data in missing_items:
        text = f"{item_data.get('album', '')} - {item_data['artist']}" if item_data.get("album") else f"{item_data['title']} - {item_data['artist']}"
        db.add(WebhookBatchItem(
            batch_id=batch.id, track=item_data["title"], artist=item_data["artist"],
            album=item_data.get("album"), text=text,
        ))
    await db.commit()
    from app.services.webhook_service import send_webhook_batch
    await send_webhook_batch(batch.id)


async def _cleanup_old_playlists(settings: SystemSettings):
    """Delete old SonicAI-generated playlists from Navidrome by DB created_at."""
    from datetime import timedelta
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import GeneratedPlaylist
    from app.services.navidrome_service import navidrome_delete_playlist

    keep_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.playlist_keep_days)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(GeneratedPlaylist).where(
                GeneratedPlaylist.created_at < keep_cutoff,
                GeneratedPlaylist.navidrome_playlist_id.isnot(None),
            )
        )
        old_playlists = result.scalars().all()

        for pl in old_playlists:
            try:
                logger.info(f"Deleting old playlist: {pl.playlist_name} (id={pl.navidrome_playlist_id})")
                await navidrome_delete_playlist(pl.navidrome_playlist_id)
                pl.navidrome_playlist_id = None
            except Exception as e:
                logger.warning(f"Failed to delete playlist {pl.playlist_name}: {e}")

        await db.commit()
