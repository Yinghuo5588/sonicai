"""Recommendation source registry."""

from __future__ import annotations

from app.recommendation.base import RecommendationSource


_SOURCE_REGISTRY: dict[str, type[RecommendationSource]] = {}


def register_source(source_cls: type[RecommendationSource]) -> type[RecommendationSource]:
    _SOURCE_REGISTRY[source_cls.source_type] = source_cls
    return source_cls


def get_source(source_type: str) -> type[RecommendationSource] | None:
    return _SOURCE_REGISTRY.get(source_type)


def list_sources() -> list[str]:
    return sorted(_SOURCE_REGISTRY.keys())