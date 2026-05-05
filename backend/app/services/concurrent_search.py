"""Concurrent Navidrome search — unified through library_match_service."""

import asyncio
import logging
from typing import Callable, Awaitable

from app.services.library_match_service import (
    MatchConfig,
    match_track_with_config,
)

logger = logging.getLogger(__name__)


async def _search_one(
    index: int,
    title: str,
    artist: str,
    config: MatchConfig,
    semaphore: asyncio.Semaphore,
) -> dict:
    """
    Search and match a single track through the unified library matching pipeline
    using MatchConfig.
    """
    async with semaphore:
        try:
            best = await match_track_with_config(
                title=title,
                artist=artist,
                config=config,
            )

            return {
                "index": index,
                "title": title,
                "artist": artist,
                "best_match": best,
            }

        except Exception as e:
            logger.error(
                "[concurrent_search] failed index=%s title=%s artist=%s: %s",
                index, title, artist, e,
            )
            return {
                "index": index,
                "title": title,
                "artist": artist,
                "best_match": None,
                "error": str(e),
            }


async def batch_search_and_match(
    tracks: list[dict],
    config: MatchConfig,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
) -> list[dict]:
    """
    Concurrently search and match a list of tracks against Navidrome
    using MatchConfig.

    Args:
        tracks:            List of {"title": ..., "artist": ...}
        config:           MatchConfig instance (threshold, concurrency, ...).
        progress_callback: Optional async callback(done, total)

    Returns:
        List of results in original order,
        each with "index", "title", "artist", "best_match".
    """
    concurrency = max(1, min(20, config.concurrency))
    semaphore = asyncio.Semaphore(concurrency)
    total = len(tracks)

    tasks = []
    for i, t in enumerate(tracks):
        title = t.get("title", "")
        artist = t.get("artist", "")
        if not title:
            continue
        tasks.append(_search_one(i, title, artist, config, semaphore))

    results: list[dict | None] = [None] * total  # type: ignore
    done_count = 0

    for coro in asyncio.as_completed(tasks):
        result = await coro
        idx = result["index"]
        results[idx] = result
        done_count += 1

        if progress_callback and done_count % 10 == 0:
            await progress_callback(done_count, total)

    if progress_callback:
        await progress_callback(done_count, total)

    # Fill gaps (skipped tracks without title)
    for i in range(total):
        if results[i] is None:
            results[i] = {
                "index": i,
                "title": tracks[i].get("title", ""),
                "artist": tracks[i].get("artist", ""),
                "best_match": None,
            }

    return results