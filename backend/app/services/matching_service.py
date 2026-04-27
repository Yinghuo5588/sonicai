"""Shared track matching logic — used by hotboard, playlist sync, and recommendation."""

import logging

from app.utils.text_normalizer import score_candidate
from app.services.navidrome_service import navidrome_multi_search

logger = logging.getLogger(__name__)


def pick_best_match(
    title: str,
    artist: str,
    nav_results: list[dict],
    threshold: float,
) -> dict | None:
    """
    Score all Navidrome search results against the given title/artist.
    Returns the best match dict (with 'id', 'title', 'artist', 'album', 'score')
    if it meets the threshold, else None.
    """
    if not nav_results:
        return None

    scored = []
    for r in nav_results:
        scores = score_candidate(
            title, artist,
            r.get("title") or "", r.get("artist") or "",
        )
        if scores["score"] >= threshold:
            scored.append((scores["score"], r))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    return {
        "id": best.get("id"),
        "title": best.get("title"),
        "artist": best.get("artist"),
        "album": best.get("album"),
        "score": best_score,
    }


async def search_and_match(
    title: str,
    artist: str,
    threshold: float = 0.75,
) -> dict | None:
    """
    Convenience: run multi-strategy Navidrome search + pick_best_match in one call.
    """
    nav_results = await navidrome_multi_search(title, artist)
    return pick_best_match(title, artist, nav_results, threshold)
