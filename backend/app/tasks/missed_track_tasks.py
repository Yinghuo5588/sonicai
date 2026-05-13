"""missed_track_tasks - scheduled retry of unmatched tracks."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select

logger = logging.getLogger(__name__)


@dataclass
class RetryConfig:
    """
    Configuration for missed-track retry jobs.

    Attributes:
        max_retries:       Maximum retry attempts per track (default 3).
        refresh_library:   Whether to refresh song_library before retry (default True).
        match_config:      MatchConfig instance for matching behavior.
        force_mode:        Override match_mode for retry runs:
                             "local" / "api" / "full" / None (use global setting).
    """
    max_retries: int = 3
    refresh_library: bool = True
    match_config = None          # filled in from_settings()
    force_mode: str | None = None


async def _build_retry_config(force: bool = False) -> RetryConfig:
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings
    from app.services.library_match_service import MatchConfig

    cfg = RetryConfig()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

    if not settings:
        return cfg

    if not force and not bool(getattr(settings, "missed_track_retry_enabled", False)):
        return cfg

    cfg.max_retries = int(getattr(settings, "missed_track_retry_limit", 100) or 100)
    cfg.max_retries = max(1, min(cfg.max_retries, 1000))
    cfg.refresh_library = bool(getattr(settings, "missed_track_retry_refresh_library", True))

    mode = getattr(settings, "missed_track_retry_mode", "local") or "local"
    cfg.force_mode = mode if mode in ("local", "api", "full") else None

    cfg.match_config = MatchConfig(
        threshold=float(getattr(settings, "match_threshold", 0.75) or 0.75),
        force_mode=cfg.force_mode,
        concurrency=max(1, min(20, int(settings.search_concurrency or 5))),
        write_cache=True,
        record_miss=False,          # retry must NOT re-record miss (avoid loop)
    )

    return cfg


async def retry_missed_tracks_job(*, force: bool = False):
    """
    Retry pending missed tracks.

    Flow:
    1. Build RetryConfig; skip if disabled (unless force=True).
    2. Optional: refresh song_library + song_cache.
    3. Fetch pending rows (retry_count < max_retries), oldest first.
    4. For each: run match_track_with_config() using RetryConfig.
       - Matched  -> status = matched, record navidrome_id.
       - Unmatched: retry_count++, if >= max_retries -> status = failed.
       - Error    : record last_error, mark failed if exhausted.
    """
    from app.db.session import AsyncSessionLocal
    from app.db.models import MissedTrack

    # 1. Build config
    cfg = await _build_retry_config(force=force)

    if not force and cfg.match_config is None:
        logger.info("[missed-track-retry] disabled or no settings")
        return

    limit = cfg.max_retries  # used as limit for batch size; actual per-row limit is in row.max_retries

    # 2. Optional library refresh (only in local mode)
    if cfg.refresh_library and cfg.match_config and cfg.match_config.force_mode != "api":
        try:
            from app.services.song_library_service import sync_navidrome_to_song_library
            from app.services.song_cache import song_cache

            logger.info("[missed-track-retry] refreshing song library before retry")
            await sync_navidrome_to_song_library()
            await song_cache.refresh_full(skip_sync=True)
        except Exception as e:
            logger.warning("[missed-track-retry] refresh library failed: %s", e)

    # 3. Fetch pending rows
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MissedTrack)
            .where(MissedTrack.status == "pending")
            .where(MissedTrack.retry_count < MissedTrack.max_retries)
            .order_by(MissedTrack.created_at.asc())
            .limit(limit)
        )
        rows = result.scalars().all()

    if not rows:
        logger.info("[missed-track-retry] no pending tracks")
        return

    logger.info("[missed-track-retry] retrying %s tracks (mode=%s)", len(rows), cfg.force_mode or "global")

    for row in rows:
        now = datetime.now(timezone.utc)
        row_threshold = float(row.match_threshold or 0.75)

        try:
            from app.services.library_match_service import match_track_with_config

            # Use per-row threshold if available, else from config
            match_cfg = cfg.match_config or MatchConfig(threshold=row_threshold)
            match_cfg = MatchConfig(
                threshold=row_threshold,
                force_mode=match_cfg.force_mode,
                concurrency=match_cfg.concurrency,
                write_cache=True,
                record_miss=False,
            )

            match = await match_track_with_config(
                title=row.title,
                artist=row.artist or "",
                config=match_cfg,
            )

            async with AsyncSessionLocal() as db:
                fresh = await db.get(MissedTrack, row.id)
                if not fresh:
                    continue

                fresh.last_retry_at = now
                fresh.retry_count = (fresh.retry_count or 0) + 1
                fresh.updated_at = now

                if match:
                    fresh.status = "matched"
                    fresh.matched_at = now
                    fresh.matched_navidrome_id = str(match.get("id")) if match.get("id") else None
                    fresh.last_error = None
                elif fresh.retry_count >= fresh.max_retries:
                    fresh.status = "failed"

                await db.commit()

        except Exception as e:
            logger.warning(
                "[missed-track-retry] failed id=%s title=%s artist=%s: %s",
                row.id, row.title, row.artist, e,
            )

            async with AsyncSessionLocal() as db:
                fresh = await db.get(MissedTrack, row.id)
                if not fresh:
                    continue

                fresh.retry_count = (fresh.retry_count or 0) + 1
                fresh.last_retry_at = now
                fresh.last_error = str(e)[:2000]
                fresh.updated_at = now

                if fresh.retry_count >= fresh.max_retries:
                    fresh.status = "failed"

                await db.commit()

    logger.info("[missed-track-retry] done")