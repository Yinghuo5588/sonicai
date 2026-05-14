"""Third-party playlist sync pipeline — parse playlist URL/text and sync to Navidrome."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun
from app.recommendation.base import SourceContext
from app.recommendation.sources.playlist import PlaylistUrlSource, TextPlaylistSource
from app.recommendation.pipeline import run_candidate_playlist_pipeline

logger = logging.getLogger(__name__)


async def _mark_run_running(run_id: int) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if not run_row:
            raise RuntimeError(f"RecommendationRun not found: run_id={run_id}")

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


async def run_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    URL-based playlist sync through RecommendationSource plugin.
    """
    match_threshold = max(0.01, min(1.0, float(match_threshold or 0.75)))
    logger.info("[playlist] start run_id=%s url=%s", run_id, url)

    await _mark_run_running(run_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

        if not settings:
            await _mark_run_failed(run_id, "SystemSettings not initialized")
            raise RuntimeError("SystemSettings not initialized")

    context = SourceContext(
        run_id=run_id,
        playlist_name=playlist_name,
        match_threshold=match_threshold,
        overwrite=overwrite,
    )

    source = PlaylistUrlSource(
        context,
        url=url,
        api_base=settings.playlist_api_url,
        timeout=float(settings.playlist_parse_timeout or 30),
    )

    try:
        candidates = await source.fetch_candidates()
    except Exception as e:
        error = f"解析歌单失败: {e}"
        await _mark_run_failed(run_id, error)
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": str(e),
        }

    if not candidates:
        await _mark_run_failed(run_id, "歌单为空")
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "empty playlist",
        }

    final_name = await source.resolve_playlist_name()

    try:
        return await run_candidate_playlist_pipeline(
            run_id=run_id,
            playlist_type=source.playlist_type,
            playlist_name=final_name,
            candidates=candidates,
            match_threshold=match_threshold,
            overwrite=overwrite,
            source_type=source.source_type,
            mark_run_running=False,
        )
    except Exception as e:
        logger.exception('[playlist] pipeline failed run_id=%s', run_id)
        await _mark_run_failed(run_id, str(e))
        raise


async def run_text_sync(
    run_id: int,
    text_content: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    Text-file based playlist sync through RecommendationSource plugin.
    """
    match_threshold = max(0.01, min(1.0, float(match_threshold or 0.75)))
    logger.info("[text_sync] start run_id=%s chars=%s", run_id, len(text_content))

    await _mark_run_running(run_id)

    context = SourceContext(
        run_id=run_id,
        playlist_name=playlist_name,
        match_threshold=match_threshold,
        overwrite=overwrite,
    )

    source = TextPlaylistSource(
        context,
        text_content=text_content,
    )

    candidates = await source.fetch_candidates()

    if not candidates:
        await _mark_run_failed(run_id, "文本内容为空或解析失败")
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "empty text",
        }

    final_name = await source.resolve_playlist_name()

    try:
        return await run_candidate_playlist_pipeline(
            run_id=run_id,
            playlist_type=source.playlist_type,
            playlist_name=final_name,
            candidates=candidates,
            match_threshold=match_threshold,
            overwrite=overwrite,
            source_type=source.source_type,
            mark_run_running=False,
        )
    except Exception as e:
        logger.exception('[text_sync] pipeline failed run_id=%s', run_id)
        await _mark_run_failed(run_id, str(e))
        raise