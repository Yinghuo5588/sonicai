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
    Returns the best match dict with full score breakdown, or None if no match meets threshold.
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
            scored.append((scores["score"], scores, r))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_scores, best = scored[0]

    return {
        "id": best.get("id"),
        "title": best.get("title"),
        "artist": best.get("artist"),
        "album": best.get("album"),
        "duration": best.get("duration"),
        "score": best_score,
        "title_score": best_scores.get("title_score"),
        "artist_score": best_scores.get("artist_score"),
        "title_core_score": best_scores.get("title_core_score"),
    }

