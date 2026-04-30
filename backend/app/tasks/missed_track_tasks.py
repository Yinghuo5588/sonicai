"""missed_track_tasks - scheduled retry of unmatched tracks."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

logger = logging.getLogger(__name__)


async def retry_missed_tracks_job(*, force: bool = False):
    """
    Retry pending missed tracks.

    Flow:
    1. Read settings; skip if disabled (unless force=True).
    2. Optional: refresh song_library + song_cache.
    3. Fetch pending rows (retry_count < max_retries), oldest first.
    4. For each: run match_track_local_only().
       - Matched  -> status = matched, record navidrome_id.
       - Unmatched: retry_count++, if >= max_retries -> status = failed.
       - Error    : record last_error, mark failed if exhausted.

    Args:
        force: If True, skip the missed_track_retry_enabled setting check.
               Used for manual batch retries triggered from the API.
    """
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings, MissedTrack
    from app.services.library_match_service import match_track_local_only

    # 1. Load settings
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

    if not force and (not settings or not getattr(settings, "missed_track_retry_enabled", False)):
        logger.info("[missed-track-retry] disabled or no settings")
        return

    limit = int(getattr(settings, "missed_track_retry_limit", 100) or 100)
    limit = max(1, min(limit, 1000))

    mode = getattr(settings, "missed_track_retry_mode", "local") or "local"

    # 2. Optional library refresh (only in local mode)
    if mode == "local" and getattr(settings, "missed_track_retry_refresh_library", True):
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

    logger.info("[missed-track-retry] retrying %s tracks", len(rows))

    for row in rows:
        now = datetime.now(timezone.utc)

        try:
            if mode == "api":
                from app.services.library_match_service import match_track
                match = await match_track(
                    title=row.title,
                    artist=row.artist or "",
                    threshold=float(row.match_threshold or 0.75),
                )
            else:
                match = await match_track_local_only(
                    title=row.title,
                    artist=row.artist or "",
                    threshold=float(row.match_threshold or 0.75),
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