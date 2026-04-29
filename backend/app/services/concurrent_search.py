"""Concurrent Navidrome search — parallelizes track matching with bounded concurrency."""

import asyncio
import logging
from typing import Callable, Awaitable

from app.services.navidrome_service import navidrome_multi_search
from app.services.matching_service import pick_best_match
from app.services.song_cache import song_cache

logger = logging.getLogger(__name__)


async def _search_one(
    index: int,
    title: str,
    artist: str,
    threshold: float,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Search and match a single track, respecting concurrency limit.

    Cache lookup is tried first. On miss or low confidence, falls back to
    the real Navidrome Subsonic API. Successful API results are passively
    added to the cache for future use.
    """
    async with semaphore:
        try:
            # 1. Try cache first
            cached = song_cache.match_one(title=title, artist=artist, threshold=threshold)
            if cached:
                return {
                    "index": index,
                    "title": title,
                    "artist": artist,
                    "best_match": {
                        "id": cached["id"],
                        "title": cached["title"],
                        "artist": cached["artist"],
                        "album": cached.get("album"),
                        "score": cached["score"],
                        "source": "cache",
                    },
                }

            # 2. Cache miss — go to Navidrome API
            nav_results = await navidrome_multi_search(title, artist)
            best = pick_best_match(title, artist, nav_results, threshold)

            # 3. Passively add successful result to cache
            if best and best.get("navidrome_id"):
                await song_cache.add_song(
                    {
                        "id": best.get("navidrome_id"),
                        "title": best.get("title"),
                        "artist": best.get("artist"),
                        "album": best.get("album"),
                        "duration": best.get("duration"),
                    },
                    source="passive",
                )

            return {"index": index, "title": title, "artist": artist, "best_match": best}
        except Exception as e:
            logger.error(f"[concurrent_search] failed index={index} title={title}: {e}")
            return {"index": index, "title": title, "artist": artist, "best_match": None, "error": str(e)}


async def batch_search_and_match(
    tracks: list[dict],
    threshold: float,
    concurrency: int = 5,
    progress_callback: Callable[[int, int], Awaitable[None]] | None = None,
) -> list[dict]:
    """
    Concurrently search and match a list of tracks against Navidrome.

    Args:
        tracks: List of {"title": ..., "artist": ..., "album": ...}
        threshold: Minimum match score to accept
        concurrency: Max concurrent Navidrome requests (clamped to 1-20)
        progress_callback: Optional async callback(done_count, total_count)

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
