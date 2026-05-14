"""Recommendation abstraction layer."""

from app.recommendation.types import CandidateTrack
from app.recommendation.base import SourceContext, RecommendationSource
from app.recommendation.registry import (
    register_source,
    get_source,
    list_sources,
    get_source_metadata,
    list_source_metadata,
    ensure_builtin_sources_registered,
)

__all__ = [
    "CandidateTrack",
    "SourceContext",
    "RecommendationSource",
    "register_source",
    "get_source",
    "list_sources",
    "get_source_metadata",
    "list_source_metadata",
    "ensure_builtin_sources_registered",
]