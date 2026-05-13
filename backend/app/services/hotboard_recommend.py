"""Hotboard-based recommendation — fetch NetEase hotboard and sync to Navidrome playlist."""

import logging
from datetime import datetime, timezone

from app.db.session import AsyncSessionLocal
from app.db.models import RecommendationRun
from app.services.hotboard_service import fetch_netease_hotboard
from app.recommendation.types import CandidateTrack
from app.recommendation.pipeline import run_candidate_playlist_pipeline

logger = logging.getLogger(__name__)


async def _mark_run_failed(run_id: int, error: str) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "failed"
            run_row.error_message = error
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def run_hotboard_sync(
    run_id: int,
    limit: int = 50,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
    trigger_type: str = "manual",
) -> dict:
    """
    Hotboard sync.

    Responsibilities:
      1. Fetch hotboard data.
      2. Convert rows to CandidateTrack.
      3. Delegate matching/persistence/Navidrome/webhook to unified pipeline.
    """
    limit = max(1, min(200, int(limit or 50)))
    match_threshold = max(0.01, min(1.0, float(match_threshold or 0.75)))

    logger.info(
        "[hotboard] start run_id=%s limit=%s threshold=%s trigger_type=%s",
        run_id,
        limit,
        match_threshold,
        trigger_type,
    )

    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            await db.commit()

    try:
        hot_tracks = await fetch_netease_hotboard(limit=limit)
        logger.info("[hotboard] fetched %s tracks", len(hot_tracks))

        if not hot_tracks:
            await _mark_run_failed(run_id, "Failed to fetch hotboard data")
            return {
                "matched": 0,
                "missing": 0,
                "total": 0,
                "error": "fetch failed",
            }

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        final_name = (
            playlist_name.strip()
            if playlist_name and playlist_name.strip()
            else f"网易云热榜 - {today}"
        )

        candidates = [
            CandidateTrack(
                title=str(t.get("title", "") or ""),
                artist=str(t.get("artist", "") or ""),
                album=t.get("album") or "",
                score=t.get("index") or idx + 1,
                source_type="hotboard",
                source_seed_name=str(t.get("title", "") or ""),
                source_seed_artist=str(t.get("artist", "") or ""),
                rank_index=idx + 1,
                raw_payload=t,
            )
            for idx, t in enumerate(hot_tracks)
        ]

        return await run_candidate_playlist_pipeline(
            run_id=run_id,
            playlist_type="hotboard",
            playlist_name=final_name,
            candidates=candidates,
            match_threshold=match_threshold,
            overwrite=overwrite,
            source_type="hotboard",
            mark_run_running=False,
        )

    except Exception as e:
        logger.exception("[hotboard] run failed run_id=%s", run_id)
        await _mark_run_failed(run_id, str(e))
        raise