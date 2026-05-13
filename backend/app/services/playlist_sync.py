"""Third-party playlist sync pipeline — parse playlist URL/text and sync to Navidrome."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, RecommendationRun
from app.services.playlist_parser import parse_playlist_url, parse_text_songs
from app.recommendation.types import CandidateTrack
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


def _songs_to_candidates(
    *,
    songs: list[dict],
    source_type: str,
) -> list[CandidateTrack]:
    return [
        CandidateTrack(
            title=str(song.get("title", "") or ""),
            artist=str(song.get("artist", "") or ""),
            album=song.get("album") or "",
            score=idx + 1,
            source_type=source_type,
            source_seed_name=str(song.get("title", "") or ""),
            source_seed_artist=str(song.get("artist", "") or ""),
            rank_index=idx + 1,
            raw_payload=song,
        )
        for idx, song in enumerate(songs)
    ]


async def run_playlist_sync(
    run_id: int,
    url: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    URL-based playlist sync.

    Responsibilities:
      1. Load parser settings.
      2. Parse playlist URL.
      3. Convert songs to CandidateTrack.
      4. Delegate matching/persistence/Navidrome/webhook to unified pipeline.
    """
    logger.info("[playlist] start run_id=%s url=%s", run_id, url)

    await _mark_run_running(run_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

        if not settings:
            await _mark_run_failed(run_id, "SystemSettings not initialized")
            raise RuntimeError("SystemSettings not initialized")

    try:
        parsed_name, platform, songs = await parse_playlist_url(
            url,
            api_base=settings.playlist_api_url,
            timeout=float(settings.playlist_parse_timeout or 30),
        )
    except Exception as e:
        error = f"解析歌单失败: {e}"
        await _mark_run_failed(run_id, error)
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": str(e),
        }

    if not songs:
        await _mark_run_failed(run_id, "歌单为空")
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "empty playlist",
        }

    final_name = (
        playlist_name.strip()
        if playlist_name and playlist_name.strip()
        else parsed_name
    )

    playlist_type = f"playlist_{platform}"
    candidates = _songs_to_candidates(
        songs=songs,
        source_type=playlist_type,
    )

    return await run_candidate_playlist_pipeline(
        run_id=run_id,
        playlist_type=playlist_type,
        playlist_name=final_name,
        candidates=candidates,
        match_threshold=match_threshold,
        overwrite=overwrite,
        source_type=playlist_type,
        mark_run_running=False,
    )


async def run_text_sync(
    run_id: int,
    text_content: str,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
) -> dict:
    """
    Text-file based playlist sync.

    Responsibilities:
      1. Parse plain text.
      2. Convert songs to CandidateTrack.
      3. Delegate matching/persistence/Navidrome/webhook to unified pipeline.
    """
    logger.info("[text_sync] start run_id=%s chars=%s", run_id, len(text_content))

    await _mark_run_running(run_id)

    parsed_name, platform, songs = parse_text_songs(text_content)

    if not songs:
        await _mark_run_failed(run_id, "文本内容为空或解析失败")
        return {
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "empty text",
        }

    final_name = (
        playlist_name.strip()
        if playlist_name and playlist_name.strip()
        else parsed_name
    )

    playlist_type = f"playlist_{platform}"
    candidates = _songs_to_candidates(
        songs=songs,
        source_type=playlist_type,
    )

    return await run_candidate_playlist_pipeline(
        run_id=run_id,
        playlist_type=playlist_type,
        playlist_name=final_name,
        candidates=candidates,
        match_threshold=match_threshold,
        overwrite=overwrite,
        source_type=playlist_type,
        mark_run_running=False,
    )