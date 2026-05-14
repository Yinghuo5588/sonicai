"""Built-in recommendation source plugins."""

from app.recommendation.registry import register_source
from app.recommendation.sources.hotboard import HotboardSource
from app.recommendation.sources.playlist import (
    PlaylistUrlSource,
    TextPlaylistSource,
    IncrementalPlaylistSource,
)

register_source(HotboardSource)
register_source(PlaylistUrlSource)
register_source(TextPlaylistSource)
register_source(IncrementalPlaylistSource)

__all__ = [
    "HotboardSource",
    "PlaylistUrlSource",
    "TextPlaylistSource",
    "IncrementalPlaylistSource",
]