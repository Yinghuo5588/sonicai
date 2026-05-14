"""Recommendation source plugin base classes."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.recommendation.types import CandidateTrack


@dataclass(slots=True)
class SourceContext:
    """
    Runtime context passed to a recommendation source.

    Source only fetches/parses candidates.
    Matching, persistence, Navidrome playlist creation and webhook are handled
    by pipeline.
    """

    run_id: int
    playlist_name: str | None = None
    match_threshold: float = 0.75
    overwrite: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


class RecommendationSource(ABC):
    """
    Base interface for all recommendation/import sources.
    """

    source_type: str
    playlist_type: str

    def __init__(self, context: SourceContext):
        self.context = context

    @abstractmethod
    async def fetch_candidates(self) -> list[CandidateTrack]:
        """Fetch or parse candidates."""
        raise NotImplementedError

    @abstractmethod
    async def default_playlist_name(self) -> str:
        """Return default playlist name."""
        raise NotImplementedError

    async def resolve_playlist_name(self) -> str:
        """Use user-provided playlist name when available, otherwise default."""
        if self.context.playlist_name and self.context.playlist_name.strip():
            return self.context.playlist_name.strip()
        return await self.default_playlist_name()