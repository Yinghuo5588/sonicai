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
    get_user_top_tracks, get_user_top_artists, get_user_recent_tracks,
    get_similar_tracks, get_similar_artists, get_artist_top_tracks,
)
from app.services.navidrome_service import navidrome_search, navidrome_create_playlist, navidrome_add_to_playlist, navidrome_delete_playlist
from app.utils.text_normalizer import normalize_title, normalize_artist, dedup_key

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Entry points (called by tasks / routes)
# ─────────────────────────────────────────────

async def run_full_recommendation(trigger_type: str = "manual"):
    """Run both playlist types as part of a single recommendation run."""
    logger.info(f"[run] start run_type=full trigger_type={trigger_type}")
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="full", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()

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


async def run_similar_tracks_only(trigger_type: str = "manual"):
    logger.info(f"[run] start run_type=similar_tracks trigger_type={trigger_type}")
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="similar_tracks", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()

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


async def run_similar_artists_only(trigger_type: str = "manual"):
    logger.info(f"[run] start run_type=similar_artists trigger_type={trigger_type}")
    async with AsyncSessionLocal() as db:
        run = RecommendationRun(run_type="similar_artists", status="running")
        db.add(run)
        await db.flush()
        run_id = run.id
        await db.commit()

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
    logger.info(
        f"[similar_tracks] config: seed_source_mode={getattr(settings, 'seed_source_mode', 'recent_plus_top')} "
        f"recent_tracks_limit={getattr(settings, 'recent_tracks_limit', 100)} "
        f"top_period={getattr(settings, 'top_period', '1month')} "
        f"recent_top_mix_ratio={getattr(settings, 'recent_top_mix_ratio', 70)} "
        f"match_threshold={getattr(settings, 'match_threshold', 0.75)} "
        f"duplicate_avoid_days={settings.duplicate_avoid_days} "
        f"balance={settings.recommendation_balance}"
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

    # 1. Get user seeds based on seed_source_mode
    seed_mode = getattr(settings, 'seed_source_mode', 'recent_plus_top') or 'recent_plus_top'
    seed_limit = settings.top_track_seed_limit or 8

    if seed_mode == 'recent_only':
        recent_limit = getattr(settings, 'recent_tracks_limit', 100) or 100
        recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=recent_limit)
        recent_counter: dict[tuple, int] = {}
        for t in recent_tracks:
            title = t.get("name", "")
            artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
            if title and artist:
                key = (title.lower(), artist.lower())
                recent_counter[key] = recent_counter.get(key, 0) + 1
        sorted_recent = sorted(recent_counter.items(), key=lambda x: x[1], reverse=True)
        seeds = [
            {"name": k[0], "artist": {"name": k[1]}, "play_count": v}
            for k, v in sorted_recent[:seed_limit]
        ]
    elif seed_mode == 'top_only':
        period = getattr(settings, 'top_period', '1month') or '1month'
        top_tracks = await get_user_top_tracks(settings.lastfm_username, limit=seed_limit, period=period)
        seeds = [t for t in top_tracks if t.get("name") and t.get("artist")]
    else:  # recent_plus_top
        recent_limit = getattr(settings, 'recent_tracks_limit', 100) or 100
        recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=recent_limit)
        recent_counter: dict[tuple, int] = {}
        for t in recent_tracks:
            title = t.get("name", "")
            artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
            if title and artist:
                key = (title.lower(), artist.lower())
                recent_counter[key] = recent_counter.get(key, 0) + 1
        sorted_recent = sorted(recent_counter.items(), key=lambda x: x[1], reverse=True)

        # recent_top_mix_ratio: what fraction of seeds come from recent
        recent_ratio = (getattr(settings, 'recent_top_mix_ratio', 70) or 70) / 100.0
        target_recent = int(seed_limit * recent_ratio)

        recent_seeds = [
            {"name": k[0], "artist": {"name": k[1]}, "play_count": v}
            for k, v in sorted_recent[:target_recent]
        ]
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
    logger.info(f"[similar_tracks] seeds: {len(seeds)} total, {sum(1 for s in seeds if 'play_count' in s)} from recent")

    candidates = []
    seen_keys = set()

    # balance: 0=conservative (fewer candidates), 100=exploratory (more candidates)
    balance = float(settings.recommendation_balance or 55) / 100.0
    # candidate pool multiplier: configurable range
    min_mult = float(getattr(settings, 'candidate_pool_multiplier_min', 2.0) or 2.0)
    max_mult = float(getattr(settings, 'candidate_pool_multiplier_max', 10.0) or 10.0)
    candidate_pool_size = int(settings.similar_playlist_size * (min_mult + balance * (max_mult - min_mult)))

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
    logger.info(f"[similar_tracks] candidates after pool cutoff: {len(candidates)}, pool_size={candidate_pool_size}")

    # 4. Remove tracks recommended in the last `duplicate_avoid_days` days
    candidates = await _filter_recent(db, candidates, settings.duplicate_avoid_days)
    logger.info(f"[similar_tracks] candidates after recent filter: {len(candidates)}")

    # 5. Navidrome matching
    matched_song_ids = []
    missing_items = []
    logger.info(f"[similar_tracks] starting Navidrome matching for {len(candidates)} candidates")

    for idx, item_data in enumerate(candidates):
        match = await _match_to_navidrome(db, item_data)
        if idx % 50 == 0:
            logger.info(f"[similar_tracks] Navidrome matching progress: {idx+1}/{len(candidates)}")
        logger.debug(f"[similar_tracks] item {idx+1}/{len(candidates)}: title={item_data['title'][:20]} matched={'YES' if match and match.get('selected_song_id') else 'NO'}")
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

        db.add(nm)

    logger.info(
        f"[playlist] ready type=similar_tracks "
        f"matched={len(matched_song_ids)} missing={len(missing_items)} "
        f"total_candidates={len(candidates)} name={playlist_name}"
    )
    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    # 6. Create Navidrome playlist — only if we have matched songs
    if matched_song_ids:
        navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
        if navidrome_playlist_id:
            try:
                await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_song_ids)
                playlist.navidrome_playlist_id = str(navidrome_playlist_id)
            except Exception as e:
                logger.error(f"[playlist] failed to add songs to playlist {navidrome_playlist_id}: {e}")
                # Rollback: delete the empty playlist from Navidrome to avoid ghost playlists
                await navidrome_delete_playlist(str(navidrome_playlist_id))
                playlist.status = "failed"
                playlist.error_message = f"Failed to add songs: {e}"
                await db.commit()
                return
    else:
        logger.warning(f"[playlist] no matched songs for '{playlist_name}', skipping Navidrome playlist creation")

    # 7. Webhook for missing items (if mode allows)
    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items, settings)

    await db.commit()


# ─────────────────────────────────────────────
# Similar Artists pipeline
# ─────────────────────────────────────────────

async def _generate_similar_artists(db: AsyncSession, run_id: int, settings):
    logger.info(
        f"[similar_artists] config: seed_source_mode={getattr(settings, 'seed_source_mode', 'recent_plus_top')} "
        f"recent_tracks_limit={getattr(settings, 'recent_tracks_limit', 100)} "
        f"top_period={getattr(settings, 'top_period', '1month')} "
        f"recent_top_mix_ratio={getattr(settings, 'recent_top_mix_ratio', 70)} "
        f"match_threshold={getattr(settings, 'match_threshold', 0.75)} "
        f"duplicate_avoid_days={settings.duplicate_avoid_days} "
        f"balance={settings.recommendation_balance}"
    )

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

    # 1. Recent tracks → aggregate by artist
    recent_tracks = await get_user_recent_tracks(settings.lastfm_username, limit=100)
    artist_counter: dict[str, int] = {}
    for t in recent_tracks:
        artist = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else (t.get("artist", {}) or "")
        if artist:
            artist_counter[artist.lower()] = artist_counter.get(artist.lower(), 0) + 1

    sorted_recent_artists = sorted(artist_counter.items(), key=lambda x: x[1], reverse=True)
    recent_seed_artists = [{"name": a[0].title(), "play_count": a[1]} for a in sorted_recent_artists[:settings.top_artist_seed_limit]]

    # 2. Fill remaining with top artists of last month
    if len(recent_seed_artists) < settings.top_artist_seed_limit:
        top_artists = await get_user_top_artists(settings.lastfm_username, limit=settings.top_artist_seed_limit, period="1month")
        existing = {a["name"].lower() for a in recent_seed_artists}
        for a in top_artists:
            name = a.get("name", "")
            if name and name.lower() not in existing:
                recent_seed_artists.append(a)
                existing.add(name.lower())
            if len(recent_seed_artists) >= settings.top_artist_seed_limit:
                break

    seed_artists = recent_seed_artists
    logger.info(f"[similar_artists] seeds: {len(seed_artists)} total, {sum(1 for a in seed_artists if 'play_count' in a)} from recent")

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
        per_seed = 5  # fixed: top N similar artists per seed
        for artist in similar[:per_seed]:  # top N similar artists per seed
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
        if idx % 50 == 0:
            logger.info(f"[similar_artists] Navidrome matching progress: {idx+1}/{len(candidates)}")
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

        db.add(nm)

    playlist.total_candidates = len(candidates)
    playlist.matched_count = len(matched_song_ids)
    playlist.missing_count = len(missing_items)
    playlist.status = "success"

    logger.info(
        f"[playlist] ready type={playlist.playlist_type} "
        f"matched={len(matched_song_ids)} missing={len(missing_items)} "
        f"total_candidates={len(candidates)} name={playlist_name}"
    )

    navidrome_playlist_id = None
    if matched_song_ids:
        navidrome_playlist_id = await navidrome_create_playlist(playlist_name)
    if navidrome_playlist_id and matched_song_ids:
        try:
            await navidrome_add_to_playlist(str(navidrome_playlist_id), matched_song_ids)
            playlist.navidrome_playlist_id = str(navidrome_playlist_id)
        except Exception as e:
            logger.error(f"[playlist] failed to add songs to playlist {navidrome_playlist_id}: {e}")
            await navidrome_delete_playlist(str(navidrome_playlist_id))
            playlist.status = "failed"
            playlist.error_message = f"Failed to add songs: {e}"
            await db.commit()
            return

    if settings.library_mode_default == "allow_missing" and missing_items:
        await _create_webhook_batch(db, run_id, playlist, missing_items, settings)

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
    original_count = len(candidates)
    filtered = [c for c in candidates if c["dedup_key"] not in recent_keys]

    logger.info(
        f"[filter-recent] avoid_days={avoid_days} input={original_count} "
        f"recent_keys={len(recent_keys)} output={len(filtered)} "
        f"filtered={original_count - len(filtered)}"
    )
    if original_count - len(filtered) > 0:
        sample = [c["dedup_key"] for c in candidates if c["dedup_key"] in recent_keys][:5]
        logger.info(f"[filter-recent] sample filtered keys: {sample}")

    return filtered


async def _match_to_navidrome(db: AsyncSession, item_data: dict) -> dict | None:
    """Search Navidrome with 8-strategy multi-query, score all results, return best."""
    from app.utils.text_normalizer import score_candidate, make_search_queries, to_simplified

    logger = logging.getLogger(__name__)
    title = item_data["title"]
    artist = item_data["artist"]

    queries = make_search_queries(title, artist)
    seen_ids: set[str] = set()
    all_results: list[dict] = []

    for q_info in queries:
        q = q_info["query"]
        label = q_info["label"]
        results = await navidrome_search(q, limit=10)
        logger.info(f"[match-query] title={title} artist={artist} query='{q}' label={label} hits={len(results)}")
        for r in results:
            rid = r.get("id")
            if rid and rid not in seen_ids:
                seen_ids.add(rid)
                r["_query_label"] = label
                all_results.append(r)
        # Run all queries for maximum coverage; no early stop
        # (keep this comment so we know the break was intentionally removed)

    if not all_results:
        logger.warning(f"[match] no results for title={title} artist={artist}")
        return None

    # Score all candidates
    scored = []
    for r in all_results:
        scores = score_candidate(title, artist, r.get("title") or "", r.get("artist") or "")
        r["_title_score"] = scores["title_score"]
        r["_artist_score"] = scores["artist_score"]
        r["_combined_score"] = scores["score"]
        scored.append((scores["score"], r))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]

    # Log top-3 candidates for observability
    for rank, (sc, cand) in enumerate(scored[:3], 1):
        logger.info(
            f"[match-top] title={title} artist={artist} "
            f"rank={rank} score={sc:.3f} "
            f"title_score={cand.get('_title_score', 0):.3f} "
            f"artist_score={cand.get('_artist_score', 0):.3f} "
            f"nav_title={cand.get('title')} nav_artist={cand.get('artist')}"
        )

    logger.info(
        f"[match] title={title} artist={artist} "
        f"queries={len(queries)} candidates={len(all_results)} "
        f"best_score={best_score:.3f} "
        f"title_score={best.get('_title_score', 0):.3f} "
        f"artist_score={best.get('_artist_score', 0):.3f} "
        f"best_nav_title={best.get('title')} best_nav_artist={best.get('artist')}"
    )

    threshold = float(getattr(settings, 'match_threshold', 0.75) or 0.75)
    if best and best_score >= threshold:
        logger.info(f"[match-accepted] title={title} artist={artist} best_query_label={best.get('_query_label')} confidence={best_score:.3f}")
        return {
            "selected_song_id": best.get("id"),
            "selected_title": best.get("title"),
            "selected_artist": best.get("artist"),
            "selected_album": best.get("album"),
            "confidence_score": best_score,
            "title_score": best.get("_title_score"),
            "artist_score": best.get("_artist_score"),
            "search_query": f"{title} {artist}",
            "raw_response": best,
        }
    # Log failure with best score for debugging
    logger.info(f"[match] REJECTED title={title} artist={artist} best_score={best_score:.3f} best_nav={best.get('title') if best else None}")
    return None


async def _create_webhook_batch(db: AsyncSession, run_id: int, playlist, missing_items: list[dict], settings=None):
    """Create a webhook batch for missing items."""
    max_retry = settings.webhook_retry_count if settings else 3
    batch = WebhookBatch(
        run_id=run_id,
        playlist_type=playlist.playlist_type,
        status="pending",
        max_retry_count=max_retry,
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
