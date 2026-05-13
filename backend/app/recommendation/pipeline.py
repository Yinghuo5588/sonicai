"""Unified recommendation/import pipeline.

This module handles the common workflow:

CandidateTrack list
-> batch match against Navidrome
-> persist GeneratedPlaylist / RecommendationItem / NavidromeMatch
-> create Navidrome playlist
-> create webhook batch for missing tracks
-> update RecommendationRun status
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SystemSettings,
    RecommendationRun,
    GeneratedPlaylist,
    RecommendationItem,
    NavidromeMatch,
    WebhookBatch,
    WebhookBatchItem,
)
from app.recommendation.types import CandidateTrack
from app.services.concurrent_search import batch_search_and_match
from app.services.library_match_service import MatchConfig
from app.services.navidrome_service import (
    navidrome_create_playlist,
    navidrome_add_to_playlist,
    navidrome_delete_playlist,
    navidrome_list_playlists,
)
from app.services.webhook_service import send_webhook_batch
from app.utils.text_normalizer import dedup_key

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PipelineSettings:
    search_concurrency: int = 5
    webhook_url: str | None = None
    webhook_retry_count: int = 3
    library_mode_default: str = "allow_missing"


async def _load_pipeline_settings() -> PipelineSettings:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        s = result.scalar_one_or_none()

        if not s:
            return PipelineSettings()

        return PipelineSettings(
            search_concurrency=max(1, min(20, int(getattr(s, "search_concurrency", 5) or 5))),
            webhook_url=getattr(s, "webhook_url", None),
            webhook_retry_count=int(getattr(s, "webhook_retry_count", 3) or 3),
            library_mode_default=getattr(s, "library_mode_default", "allow_missing") or "allow_missing",
        )


def _candidate_to_item_kwargs(
    *,
    playlist_id: int,
    candidate: CandidateTrack,
    index: int,
    fallback_source_type: str,
) -> dict[str, Any]:
    title = candidate.normalized_title()
    artist = candidate.normalized_artist()
    source_type = candidate.source_type or fallback_source_type

    return {
        "generated_playlist_id": playlist_id,
        "title": title,
        "artist": artist,
        "album": candidate.album or "",
        "score": candidate.score if candidate.score is not None else index + 1,
        "source_type": source_type,
        "source_seed_name": candidate.source_seed_name or title,
        "source_seed_artist": candidate.source_seed_artist or artist,
        "dedup_key": dedup_key(title, artist),
        "rank_index": candidate.rank_index or index + 1,
        "raw_payload_json": (
            json.dumps(candidate.raw_payload, ensure_ascii=False)
            if candidate.raw_payload is not None
            else None
        ),
    }


def _missing_text(payload: dict[str, Any]) -> str:
    title = (payload.get("title") or "").strip()
    artist = (payload.get("artist") or "").strip()

    if title and artist:
        return f"{title} - {artist}"

    if title:
        return title

    return artist


async def _mark_run_failed(run_id: int, error: str) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "failed"
            run_row.error_message = error
            run_row.finished_at = datetime.now(timezone.utc)
            await db.commit()


async def _mark_run_running(run_id: int) -> None:
    async with AsyncSessionLocal() as db:
        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "running"
            run_row.started_at = datetime.now(timezone.utc)
            await db.commit()


async def run_candidate_playlist_pipeline(
    *,
    run_id: int,
    playlist_type: str,
    playlist_name: str,
    candidates: list[CandidateTrack],
    match_threshold: float = 0.75,
    overwrite: bool = False,
    source_type: str | None = None,
    mark_run_running: bool = True,
) -> dict:
    """
    Run the common candidate -> playlist pipeline.

    Args:
        run_id:
            RecommendationRun id.
        playlist_type:
            GeneratedPlaylist.playlist_type, e.g. "hotboard", "playlist_netease".
        playlist_name:
            Final Navidrome/SonicAI playlist name.
        candidates:
            Unified CandidateTrack list.
        match_threshold:
            Matching threshold.
        overwrite:
            Delete same-name Navidrome playlist before creating a new one.
        source_type:
            Fallback RecommendationItem.source_type when candidate.source_type is empty.
        mark_run_running:
            Whether this pipeline should set RecommendationRun to running at start.
    """
    fallback_source_type = source_type or playlist_type

    logger.info(
        "[pipeline] start run_id=%s playlist_type=%s name=%s candidates=%s threshold=%s overwrite=%s",
        run_id,
        playlist_type,
        playlist_name,
        len(candidates),
        match_threshold,
        overwrite,
    )

    if mark_run_running:
        await _mark_run_running(run_id)

    valid_candidates = [
        c for c in candidates
        if c.normalized_title()
    ]

    if not valid_candidates:
        await _mark_run_failed(run_id, "No valid candidate tracks")
        return {
            "playlist_name": playlist_name,
            "matched": 0,
            "missing": 0,
            "total": 0,
            "error": "No valid candidate tracks",
        }

    settings = await _load_pipeline_settings()

    # Overwrite same-name playlist from Navidrome if requested.
    if overwrite:
        all_pls = await navidrome_list_playlists()
        for pl in all_pls:
            if pl.get("name") == playlist_name and pl.get("id"):
                logger.info(
                    "[pipeline] overwriting existing playlist name=%s id=%s",
                    playlist_name,
                    pl["id"],
                )
                await navidrome_delete_playlist(str(pl["id"]))
                break

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async with AsyncSessionLocal() as db:
        playlist = GeneratedPlaylist(
            run_id=run_id,
            playlist_type=playlist_type,
            playlist_name=playlist_name,
            playlist_date=today,
            status="running",
        )
        db.add(playlist)
        await db.flush()

        search_tracks = [c.to_match_input() for c in valid_candidates]

        async def _log_progress(done: int, total: int):
            if done == 1 or done == total or done % 20 == 0:
                logger.info(
                    "[pipeline] matching progress run_id=%s playlist_type=%s %s/%s",
                    run_id,
                    playlist_type,
                    done,
                    total,
                )

        match_cfg = MatchConfig(
            threshold=match_threshold,
            concurrency=settings.search_concurrency,
        )

        search_results = await batch_search_and_match(
            tracks=search_tracks,
            config=match_cfg,
            progress_callback=_log_progress,
        )

        matched_ids: list[str] = []
        missing_candidates: list[CandidateTrack] = []

        for idx, sr in enumerate(search_results):
            candidate = valid_candidates[idx]
            title = sr["title"]
            artist = sr["artist"]

            if not title or not artist:
                continue

            item = RecommendationItem(
                **_candidate_to_item_kwargs(
                    playlist_id=playlist.id,
                    candidate=candidate,
                    index=idx,
                    fallback_source_type=fallback_source_type,
                )
            )
            db.add(item)
            await db.flush()

            best = sr.get("best_match")

            if best:
                matched_ids.append(str(best["id"]))
                db.add(
                    NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=True,
                        search_query=f"{title} {artist}",
                        selected_song_id=str(best["id"]),
                        selected_title=best.get("title"),
                        selected_artist=best.get("artist"),
                        selected_album=best.get("album"),
                        confidence_score=best.get("score"),
                    )
                )
            else:
                db.add(
                    NavidromeMatch(
                        recommendation_item_id=item.id,
                        matched=False,
                        search_query=f"{title} {artist}",
                    )
                )
                missing_candidates.append(candidate)

        logger.info(
            "[pipeline] matched run_id=%s playlist_type=%s total=%s matched=%s missing=%s",
            run_id,
            playlist_type,
            len(valid_candidates),
            len(matched_ids),
            len(missing_candidates),
        )

        playlist.total_candidates = len(valid_candidates)
        playlist.matched_count = len(matched_ids)
        playlist.missing_count = len(missing_candidates)

        navidrome_playlist_id: str | None = None

        if matched_ids:
            navidrome_playlist_id = await navidrome_create_playlist(playlist_name)

            if not navidrome_playlist_id:
                playlist.error_message = "Failed to create Navidrome playlist"
                playlist.status = "failed"

                run_row = await db.get(RecommendationRun, run_id)
                if run_row:
                    run_row.status = "failed"
                    run_row.error_message = "Failed to create Navidrome playlist"
                    run_row.finished_at = datetime.now(timezone.utc)

                await db.commit()

                return {
                    "playlist_name": playlist_name,
                    "playlist_type": playlist_type,
                    "matched": len(matched_ids),
                    "missing": len(missing_candidates),
                    "total": len(valid_candidates),
                    "error": "Failed to create Navidrome playlist",
                }

            ok = await navidrome_add_to_playlist(
                str(navidrome_playlist_id),
                matched_ids,
            )

            if ok:
                playlist.navidrome_playlist_id = str(navidrome_playlist_id)
            else:
                playlist.error_message = "Failed to add songs to Navidrome playlist"
                playlist.status = "failed"

                run_row = await db.get(RecommendationRun, run_id)
                if run_row:
                    run_row.status = "failed"
                    run_row.error_message = "Failed to add songs to Navidrome playlist"
                    run_row.finished_at = datetime.now(timezone.utc)

                await db.commit()

                try:
                    await navidrome_delete_playlist(str(navidrome_playlist_id))
                except Exception:
                    logger.warning(
                        "[pipeline] failed to rollback Navidrome playlist id=%s",
                        navidrome_playlist_id,
                    )

                return {
                    "playlist_name": playlist_name,
                    "playlist_type": playlist_type,
                    "matched": len(matched_ids),
                    "missing": len(missing_candidates),
                    "total": len(valid_candidates),
                    "error": "Failed to add songs to Navidrome playlist",
                }

        playlist.status = "success"

        run_row = await db.get(RecommendationRun, run_id)
        if run_row:
            run_row.status = "success"
            run_row.finished_at = datetime.now(timezone.utc)

        should_webhook_missing = (
            bool(missing_candidates)
            and bool(settings.webhook_url)
            and settings.library_mode_default == "allow_missing"
        )

        if should_webhook_missing:
            missing_payloads = [c.to_missing_payload() for c in missing_candidates]

            batch = WebhookBatch(
                run_id=run_id,
                playlist_type=playlist_type,
                status="pending",
                max_retry_count=settings.webhook_retry_count,
                payload_json=json.dumps(
                    {"items": missing_payloads},
                    ensure_ascii=False,
                ),
            )
            db.add(batch)
            await db.flush()

            for payload in missing_payloads:
                db.add(
                    WebhookBatchItem(
                        batch_id=batch.id,
                        track=payload.get("title"),
                        artist=payload.get("artist"),
                        album=payload.get("album"),
                        text=_missing_text(payload),
                    )
                )

        await db.commit()

    # Fire webhook outside the main write session.
    if missing_candidates and settings.webhook_url and settings.library_mode_default == "allow_missing":
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WebhookBatch)
                .where(WebhookBatch.run_id == run_id)
                .order_by(WebhookBatch.id.desc())
            )
            batch = result.scalar_one_or_none()

            if batch:
                await send_webhook_batch(batch.id)

    return {
        "playlist_name": playlist_name,
        "playlist_type": playlist_type,
        "matched": len(matched_ids),
        "missing": len(missing_candidates),
        "total": len(valid_candidates),
        "navidrome_playlist_id": str(navidrome_playlist_id) if navidrome_playlist_id else None,
    }