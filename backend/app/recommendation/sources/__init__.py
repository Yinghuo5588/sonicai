"""Built-in recommendation source plugins."""

from app.recommendation.registry import register_source
from app.recommendation.sources.hotboard import HotboardSource
from app.recommendation.sources.playlist import (
    PlaylistUrlSource,
    TextPlaylistSource,
    IncrementalPlaylistSource,
)
from app.recommendation.sources.lastfm import (
    LastfmSimilarTracksSource,
    LastfmSimilarArtistsSource,
)


BUILTIN_SOURCES = (
    HotboardSource,
    PlaylistUrlSource,
    TextPlaylistSource,
    IncrementalPlaylistSource,
    LastfmSimilarTracksSource,
    LastfmSimilarArtistsSource,
)


for source_cls in BUILTIN_SOURCES:
    register_source(source_cls)


__all__ = [
    "BUILTIN_SOURCES",
    "HotboardSource",
    "PlaylistUrlSource",
    "TextPlaylistSource",
    "IncrementalPlaylistSource",
    "LastfmSimilarTracksSource",
    "LastfmSimilarArtistsSource",
]