"""Concurrent Navidrome search — unified through library_match_service."""

import asyncio
import logging
from typing import Callable, Awaitable

from app.services.library_match_service import match_track

logger = logging.getLogger(__name__)


async def _search_one(
    index: int,
    title: str,
    artist: str,
    threshold: float,
    semaphore: asyncio.Semaphore,
) -> dict:
    """
    Search and match a single track through the unified library matching pipeline.

    Chain: manual_match -> match_cache -> memory index
           -> db alias exact -> db fuzzy -> Subsonic
    """
    async with semaphore:
        try:
            best = await match_track(
                title=title,
                artist=artist,
                threshold=threshold,
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
    threshold: float,
    concurrency: int = 5,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
) -> list[dict]:
    """
    Concurrently search and match a list of tracks against Navidrome.

    Args:
        tracks: List of {"title": ..., "artist": ...}
        threshold: Minimum match score to accept
        concurrency: Max concurrent requests (clamped 1-20)
        progress_callback: Optional async callback(done, total)

    Returns:
        List of results in original order, each with "index", "title", "artist", "best_match"
    """
    concurrency = max(1, min(20, concurrency))
    semaphore = asyncio.Semaphore(concurrency)
    total = len(tracks)

    tasks = []
    for i, t in enumerate(tracks):
        title = t.get("title", "")
        artist = t.get("artist", "")
        if not title:
            continue
        tasks.append(
            _search_one(i, title, artist, threshold, semaphore)
        )

    results: list[dict] = [None] * total  # type: ignore
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