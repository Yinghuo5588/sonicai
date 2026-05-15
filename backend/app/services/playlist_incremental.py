"""Incremental playlist sync — only adds new songs since last sync."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun, PlaylistSyncJob
from app.services.navidrome_service import (
    navidrome_delete_playlist,
    navidrome_list_playlists,
    navidrome_get_playlist_songs,
)
from app.recommendation.base import SourceContext
from app.recommendation.sources.playlist import IncrementalPlaylistSource
from app.recommendation.pipeline import run_incremental_candidate_playlist_pipeline

logger = logging.getLogger(__name__)


def _compute_songs_hash(songs: list[dict]) -> str:
    """Compute a deterministic hash of a song list for change detection."""
    normalized = sorted(
        [
            (
                str(s.get("title", "") or "").strip().lower(),
                str(s.get("artist", "") or "").strip().lower(),
            )
            for s in songs
        ],
        key=lambda x: (x[0], x[1]),
    )
    return hashlib.sha256(
        json.dumps(normalized, ensure_ascii=False).encode()
    ).hexdigest()


async def _mark_run_running(run_id: int) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            await db.commit()


async def _mark_run_failed(run_id: int, error: str) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "failed"
            run_row.error_message = error
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def _mark_run_success_skipped(
    run_id: int,
    message: str,
) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "success"
            run_row.error_message = message
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def run_incremental_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
    playlist_sync_job_id: int | None = None,
) -> dict:
    """
    Incremental playlist sync.

    Responsibilities:
    1. Load settings.
    2. Parse playlist URL via IncrementalPlaylistSource.
    3. Compute current hash and skip if unchanged.
    4. Find existing Navidrome playlist and existing song ids.
    5. Delegate matching / DB persistence / Navidrome add / webhook to incremental pipeline.
    """
    match_threshold = max(0.01, min(1.0, float(match_threshold or 0.75)))

    logger.info(
        "[playlist_incr] start run_id=%s url=%s threshold=%s overwrite=%s",
        run_id,
        url,
        match_threshold,
        overwrite,
    )

    await _mark_run_running(run_id)

    job_row: PlaylistSyncJob | None = None

    if playlist_sync_job_id is not None:
        async with AsyncSessionLocal() as db:
            job_row = await db.get(PlaylistSyncJob, playlist_sync_job_id)
            if not job_row:
                await _mark_run_failed(run_id, "PlaylistSyncJob not found")
                return {
                    "matched": 0,
                    "new_added": 0,
                    "missing": 0,
                    "total": 0,
                    "error": "playlist sync job not found",
                }

    last_hash = job_row.last_hash if job_row else None
    if last_hash is None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()
            if settings:
                last_hash = settings.playlist_sync_last_hash

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

        if not settings:
            await _mark_run_failed(run_id, "SystemSettings not initialized")
            raise RuntimeError("SystemSettings not initialized")

        api_base = settings.playlist_api_url
        parse_timeout = float(settings.playlist_parse_timeout or 30)

    context = SourceContext(
        run_id=run_id,
        playlist_name=playlist_name,
        match_threshold=match_threshold,
        overwrite=overwrite,
    )

    source = IncrementalPlaylistSource(
        context,
        url=url,
        api_base=api_base,
        timeout=parse_timeout,
    )

    try:
        candidates = await source.fetch_candidates()
        songs = getattr(source, "raw_songs", [])
    except Exception as e:
        error = f"解析歌单失败: {e}"
        await _mark_run_failed(run_id, error)
        return {
            "matched": 0,
            "new_added": 0,
            "missing": 0,
            "total": 0,
            "error": str(e),
        }

    if not songs:
        await _mark_run_failed(run_id, "歌单为空")
        return {
            "matched": 0,
            "new_added": 0,
            "missing": 0,
            "total": 0,
            "error": "empty playlist",
        }

    current_hash = _compute_songs_hash(songs)

    if current_hash == last_hash:
        logger.info(
            "[playlist_incr] no changes detected, skipping sync run_id=%s",
            run_id,
        )
        await _mark_run_success_skipped(run_id, "歌单未变化,跳过同步")
        return {
            "matched": 0,
            "new_added": 0,
            "missing": 0,
            "total": len(songs),
            "skipped": True,
            "reason": "unchanged",
        }

    final_name = await source.resolve_playlist_name()

    existing_song_ids: set[str] = set()
    existing_navidrome_playlist_id: str | None = None

    try:
        all_pls = await navidrome_list_playlists()

        if overwrite:
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    logger.info(
                        "[playlist_incr] overwriting existing playlist name=%s id=%s",
                        final_name,
                        pl["id"],
                    )
                    await navidrome_delete_playlist(str(pl["id"]))
                    break
        else:
            for pl in all_pls:
                if pl.get("name") == final_name and pl.get("id"):
                    existing_navidrome_playlist_id = str(pl["id"])
                    pl_songs = await navidrome_get_playlist_songs(
                        existing_navidrome_playlist_id
                    )
                    existing_song_ids = {
                        str(s["id"])
                        for s in pl_songs
                        if s.get("id")
                    }
                    break

    except Exception as e:
        logger.warning(
            "[playlist_incr] failed to inspect existing Navidrome playlist: %s",
            e,
        )

    try:
        result = await run_incremental_candidate_playlist_pipeline(
            run_id=run_id,
            playlist_name=final_name,
            candidates=candidates,
            existing_song_ids=existing_song_ids,
            existing_navidrome_playlist_id=existing_navidrome_playlist_id,
            match_threshold=match_threshold,
            overwrite=overwrite,
            current_hash=current_hash,
            playlist_sync_job_id=playlist_sync_job_id,
        )
    except Exception as e:
        logger.exception("[playlist_incr] pipeline failed run_id=%s", run_id)
        await _mark_run_failed(run_id, str(e))
        raise