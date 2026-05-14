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

register_source(HotboardSource)
register_source(PlaylistUrlSource)
register_source(TextPlaylistSource)
register_source(IncrementalPlaylistSource)
register_source(LastfmSimilarTracksSource)
register_source(LastfmSimilarArtistsSource)

__all__ = [
    "HotboardSource",
    "PlaylistUrlSource",
    "TextPlaylistSource",
    "IncrementalPlaylistSource",
    "LastfmSimilarTracksSource",
    "LastfmSimilarArtistsSource",
]