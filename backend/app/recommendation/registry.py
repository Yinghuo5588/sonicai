"""Recommendation source registry."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.recommendation.base import RecommendationSource

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SourceMetadata:
    source_type: str
    playlist_type: str
    class_name: str
    display_name: str
    description: str
    is_dynamic: bool
    supported_playlist_types: list[str]


_SOURCE_REGISTRY: dict[str, type[RecommendationSource]] = {}
_BUILTINS_REGISTERED = False


def register_source(source_cls: type[RecommendationSource]) -> type[RecommendationSource]:
    """
    Register a recommendation source class.

    If the same source_type is registered twice, the latest registration wins.
    """
    source_type = getattr(source_cls, "source_type", None)
    if not source_type:
        raise ValueError(f"Source class {source_cls.__name__} missing source_type")

    old = _SOURCE_REGISTRY.get(source_type)
    if old and old is not source_cls:
        logger.warning(
            "[source-registry] overriding source_type=%s old=%s new=%s",
            source_type,
            old.__name__,
            source_cls.__name__,
        )

    _SOURCE_REGISTRY[source_type] = source_cls
    return source_cls


def ensure_builtin_sources_registered() -> None:
    """
    Ensure built-in sources are imported and registered.

    Registration happens in app.recommendation.sources.__init__.
    This helper prevents list_sources()/get_source() from returning empty
    results when callers forget to import app.recommendation.sources first.
    """
    global _BUILTINS_REGISTERED

    if _BUILTINS_REGISTERED:
        return

    # Import for side effects: sources.__init__ calls register_source(...)
    import app.recommendation.sources  # noqa: F401

    _BUILTINS_REGISTERED = True


def get_source(source_type: str) -> type[RecommendationSource] | None:
    ensure_builtin_sources_registered()
    return _SOURCE_REGISTRY.get(source_type)


def list_sources() -> list[str]:
    ensure_builtin_sources_registered()
    return sorted(_SOURCE_REGISTRY.keys())


def get_source_metadata(source_type: str) -> dict | None:
    ensure_builtin_sources_registered()

    source_cls = _SOURCE_REGISTRY.get(source_type)
    if not source_cls:
        return None

    return _source_metadata(source_cls).__dict__


def list_source_metadata() -> list[dict]:
    ensure_builtin_sources_registered()

    return [
        _source_metadata(source_cls).__dict__
        for _, source_cls in sorted(
            _SOURCE_REGISTRY.items(),
            key=lambda item: item[0],
        )
    ]


def _source_metadata(source_cls: type[RecommendationSource]) -> SourceMetadata:
    supported = getattr(source_cls, "supported_playlist_types", ()) or ()

    return SourceMetadata(
        source_type=str(getattr(source_cls, "source_type", "")),
        playlist_type=str(getattr(source_cls, "playlist_type", "")),
        class_name=source_cls.__name__,
        display_name=(
            getattr(source_cls, "display_name", None)
            or source_cls.__name__
        ),
        description=getattr(source_cls, "description", "") or "",
        is_dynamic=bool(getattr(source_cls, "is_dynamic", False)),
        supported_playlist_types=list(supported),
    )