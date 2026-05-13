"""Shared recommendation candidate types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class CandidateTrack:
    """
    Unified candidate track structure.

    This is used by all recommendation/import sources before matching
    against Navidrome.

    Examples of sources:
    - Last.fm similar tracks
    - Last.fm similar artists
    - NetEase hotboard
    - third-party playlist URL
    - text playlist upload
    - future Spotify/Deezer/ListenBrainz/AI sources
    """

    title: str
    artist: str
    album: str | None = None
    score: float | int | None = None

    source_type: str = "unknown"
    source_seed_name: str | None = None
    source_seed_artist: str | None = None

    rank_index: int | None = None
    raw_payload: dict[str, Any] | None = field(default=None)

    def normalized_title(self) -> str:
        return (self.title or "").strip()

    def normalized_artist(self) -> str:
        return (self.artist or "").strip()

    def to_match_input(self) -> dict[str, str]:
        return {
            "title": self.normalized_title(),
            "artist": self.normalized_artist(),
            "album": self.album or "",
        }

    def to_missing_payload(self) -> dict[str, Any]:
        """
        Payload shape used by webhook missing-track batches.
        """
        payload = dict(self.raw_payload or {})
        payload.setdefault("title", self.normalized_title())
        payload.setdefault("artist", self.normalized_artist())
        payload.setdefault("album", self.album or "")
        return payload