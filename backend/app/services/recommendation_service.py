"""Recommendation service — core recommendation logic."""

import logging
from datetime import datetime, timezone
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings,
    RecommendationRun,
    GeneratedPlaylist,
    RecommendationItem,
)
from app.recommendation.base import SourceContext
from app.recommendation.sources.lastfm import (
    LastfmSimilarTracksSource,
    LastfmSimilarArtistsSource,
)
from app.utils.text_normalizer import dedup_key
from app.recommendation.types import CandidateTrack
from app.recommendation.pipeline import run_candidate_playlist_pipeline

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
    """
    Generate Last.fm similar-tracks playlist through RecommendationSource plugin.
    """
    logger.info(
        f"[similar_tracks] seed_source_mode={getattr(settings, 'seed_source_mode', 'recent_plus_top')} "
        f"recent_tracks_limit={getattr(settings, 'recent_tracks_limit', 100)} "
        f"duplicate_avoid_days={settings.duplicate_avoid_days} balance={settings.recommendation_balance}"
    )

    context = SourceContext(
        run_id=run_id,
        playlist_name=None,
        match_threshold=float(settings.match_threshold or 0.75),
        overwrite=False,
    )

    async def stop_checker() -> bool:
        return await _is_run_stopped(run_id, db)

    source = LastfmSimilarTracksSource(
        context,
        settings=settings,
        stop_checker=stop_checker,
    )

    playlist_name = await source.resolve_playlist_name()

    candidates = await source.fetch_candidates()

    logger.info(f"[similar_tracks] candidates before recent filter={len(candidates)}")

    if await _is_run_stopped(run_id, db):
        logger.info(f"[similar_tracks] run_id={run_id} stopped before filter")
        return

    candidates = await _filter_recent_candidates(
        db,
        candidates,
        int(settings.duplicate_avoid_days or 0),
    )

    logger.info(f"[similar_tracks] candidates after recent filter={len(candidates)}")

    result = await run_candidate_playlist_pipeline(
        run_id=run_id,
        playlist_type=source.playlist_type,
        playlist_name=playlist_name,
        candidates=candidates,
        match_threshold=float(settings.match_threshold or 0.75),
        overwrite=False,
        source_type=source.source_type,
        mark_run_running=False,
        update_run_status=False,
    )

    if result.get("error"):
        raise RuntimeError(result["error"])

    logger.info(f"[similar_tracks] pipeline result={result}")


async def _generate_similar_artists(db: AsyncSession, run_id: int, settings):
    """
    Generate Last.fm similar-artists playlist through RecommendationSource plugin.
    """
    logger.info(
        f"[similar_artists] duplicate_avoid_days={settings.duplicate_avoid_days} "
        f"balance={settings.recommendation_balance}"
    )

    existing_keys_result = await db.execute(
        select(RecommendationItem.dedup_key).join(GeneratedPlaylist)
        .where(GeneratedPlaylist.run_id == run_id)
        .where(GeneratedPlaylist.playlist_type == "similar_tracks")
    )

    exclude_dedup_keys = {
        row[0]
        for row in existing_keys_result
        if row[0]
    }

    context = SourceContext(
        run_id=run_id,
        playlist_name=None,
        match_threshold=float(settings.match_threshold or 0.75),
        overwrite=False,
    )

    async def stop_checker() -> bool:
        return await _is_run_stopped(run_id, db)

    source = LastfmSimilarArtistsSource(
        context,
        settings=settings,
        exclude_dedup_keys=exclude_dedup_keys,
        stop_checker=stop_checker,
    )

    playlist_name = await source.resolve_playlist_name()

    candidates = await source.fetch_candidates()

    logger.info(f"[similar_artists] candidates before recent filter={len(candidates)}")

    if await _is_run_stopped(run_id, db):
        logger.info(f"[similar_artists] run_id={run_id} stopped before filter")
        return

    candidates = await _filter_recent_candidates(
        db,
        candidates,
        int(settings.duplicate_avoid_days or 0),
    )

    logger.info(f"[similar_artists] candidates after recent filter={len(candidates)}")

    result = await run_candidate_playlist_pipeline(
        run_id=run_id,
        playlist_type=source.playlist_type,
        playlist_name=playlist_name,
        candidates=candidates,
        match_threshold=float(settings.match_threshold or 0.75),
        overwrite=False,
        source_type=source.source_type,
        mark_run_running=False,
        update_run_status=False,
    )

    if result.get("error"):
        raise RuntimeError(result["error"])

    logger.info(f"[similar_artists] pipeline result={result}")


async def _filter_recent_candidates(
    db: AsyncSession,
    candidates: list[CandidateTrack],
    avoid_days: int,
) -> list[CandidateTrack]:
    """
    Filter CandidateTrack list by recently recommended dedup_key.

    This is the CandidateTrack version of _filter_recent().
    """
    from datetime import timedelta

    if not avoid_days or avoid_days <= 0:
        return candidates

    cutoff = datetime.now(timezone.utc) - timedelta(days=avoid_days)

    result = await db.execute(
        select(RecommendationItem.dedup_key)
        .join(GeneratedPlaylist)
        .where(RecommendationItem.created_at >= cutoff)
    )

    recent_keys = {row[0] for row in result if row[0]}

    original_count = len(candidates)

    filtered = [
        c for c in candidates
        if dedup_key(c.normalized_title(), c.normalized_artist()) not in recent_keys
    ]

    logger.info(
        "[filter-recent-candidates] avoid_days=%s input=%s output=%s filtered=%s",
        avoid_days,
        original_count,
        len(filtered),
        original_count - len(filtered),
    )

    return filtered


async def _cleanup_old_playlists(settings: SystemSettings):
    """Legacy cleanup entry.

    Kept for backward compatibility. The new lifecycle cleanup is implemented
    in playlist_cleanup_service and should be triggered by independent Cron
    or manual API.
    """
    try:
        from app.services.playlist_cleanup_service import run_playlist_cleanup

        # 兼容旧行为：完整推荐结束后仍尝试清理。
        # force=True 表示不要求 playlist_cleanup_enabled 开启。
        # 但是否删除 Navidrome 仍受 playlist_cleanup_delete_navidrome 控制。
        await run_playlist_cleanup(force=True)
    except Exception as e:
        logger.warning("[playlist-cleanup-legacy] failed: %s", e)
