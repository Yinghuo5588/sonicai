"""AI recommendation service."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun
from app.recommendation.base import SourceContext
from app.recommendation.sources.ai import AIRecommendationSource
from app.recommendation.pipeline import run_candidate_playlist_pipeline
from app.utils.text_normalizer import dedup_key

logger = logging.getLogger(__name__)


async def _mark_run_running(run_id: int, snapshot: dict | None = None) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            if snapshot is not None:
                run_row.config_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
            await db.commit()


async def _mark_run_failed(run_id: int, error: str) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "failed"
            run_row.error_message = error
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def run_ai_recommendation(
    *,
    run_id: int,
    prompt: str,
    mode: str = "free",
    limit: int | None = None,
    playlist_name: str | None = None,
    match_threshold: float = 0.75,
    overwrite: bool = False,
    trigger_type: str = "manual",
    use_preference_profile: bool = True,
) -> dict:
    """
    Run AI recommendation.

    AI only generates CandidateTrack.
    Matching, DB persistence, Navidrome playlist creation and webhook are handled by pipeline.
    """
    prompt = (prompt or "").strip()
    if not prompt:
        await _mark_run_failed(run_id, "Prompt is required")
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "prompt required",
        }

    match_threshold = max(0.01, min(1.0, float(match_threshold or 0.75)))

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

        if not settings:
            await _mark_run_failed(run_id, "SystemSettings not initialized")
            raise RuntimeError("SystemSettings not initialized")

        if not bool(getattr(settings, "ai_enabled", False)):
            await _mark_run_failed(run_id, "AI recommendation is disabled")
            return {
                "matched": 0,
                "missing": 0,
                "total": 0,
                "error": "ai disabled",
            }

        if not settings.ai_api_key:
            await _mark_run_failed(run_id, "AI API key is not configured")
            return {
                "matched": 0,
                "missing": 0,
                "total": 0,
                "error": "ai api key missing",
            }

        final_limit = max(
            1,
            min(
                200,
                int(limit or settings.ai_default_limit or 30),
            ),
        )

        mode = mode or "free"
        if mode not in {"free", "favorites"}:
            mode = "free"

        preference_profile = ""
        if (
            use_preference_profile
            and bool(getattr(settings, "ai_preference_profile_enabled", True))
            and getattr(settings, "ai_preference_profile_text", None)
        ):
            preference_profile = settings.ai_preference_profile_text or ""

        favorite_tracks: list[dict] = []
        favorite_dedup_keys: set[str] = set()

        if mode == "favorites":
            from app.services.favorite_tracks_service import (
                get_favorite_sample,
                get_all_favorite_dedup_keys,
            )

            sample_limit = int(getattr(settings, "ai_favorites_sample_limit", 40) or 40)
            sample_limit = max(1, min(200, sample_limit))

            favorite_tracks = await get_favorite_sample(limit=sample_limit)
            favorite_dedup_keys = await get_all_favorite_dedup_keys()

        snapshot = {
            "source": "ai",
            "trigger_type": trigger_type,
            "mode": mode,
            "ai_base_url": settings.ai_base_url,
            "ai_model": settings.ai_model,
            "ai_default_limit": settings.ai_default_limit,
            "ai_request_timeout": settings.ai_request_timeout,
            "ai_temperature": float(settings.ai_temperature or 0.8),
            "limit": final_limit,
            "match_threshold": match_threshold,
            "playlist_name": playlist_name,
            "prompt": prompt,
            "use_preference_profile": use_preference_profile,
            "has_preference_profile": bool(preference_profile),
            "favorite_sample_count": len(favorite_tracks),
        }

        await _mark_run_running(run_id, snapshot=snapshot)

    try:
        context = SourceContext(
            run_id=run_id,
            playlist_name=playlist_name,
            match_threshold=match_threshold,
            overwrite=overwrite,
            extra={
                "trigger_type": trigger_type,
                "prompt": prompt,
                "limit": final_limit,
                "mode": mode,
                "use_preference_profile": use_preference_profile,
                "favorite_sample_count": len(favorite_tracks),
            },
        )

        source = AIRecommendationSource(
            context,
            api_key=settings.ai_api_key,
            base_url=settings.ai_base_url,
            model=settings.ai_model or "gpt-4o-mini",
            user_prompt=prompt,
            limit=final_limit,
            temperature=float(settings.ai_temperature or 0.8),
            timeout=float(settings.ai_request_timeout or 60),
            mode=mode,
            preference_profile=preference_profile,
            favorite_tracks=favorite_tracks,
        )

        candidates = await source.fetch_candidates()

        if mode == "favorites" and favorite_dedup_keys:
            before_count = len(candidates)
            candidates = [
                c for c in candidates
                if dedup_key(c.normalized_title(), c.normalized_artist()) not in favorite_dedup_keys
            ]
            logger.info(
                "[ai] filtered favorite duplicates before=%s after=%s",
                before_count,
                len(candidates),
            )

        if not candidates:
            await _mark_run_failed(run_id, "AI returned no valid songs")
            return {
                "matched": 0,
                "missing": 0,
                "total": 0,
                "error": "empty ai response",
            }

        final_name = await source.resolve_playlist_name()

        return await run_candidate_playlist_pipeline(
            run_id=run_id,
            playlist_type=source.playlist_type,
            playlist_name=final_name,
            candidates=candidates,
            match_threshold=match_threshold,
            overwrite=overwrite,
            source_type=source.source_type,
            mark_run_running=False,
            update_run_status=True,
        )

    except Exception as e:
        logger.exception("[ai] recommendation failed run_id=%s", run_id)
        await _mark_run_failed(run_id, str(e))
        raise