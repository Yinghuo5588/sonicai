"""Playlist import sources."""

from __future__ import annotations

from app.recommendation.base import RecommendationSource, SourceContext
from app.recommendation.types import CandidateTrack
from app.services.playlist_parser import parse_playlist_url, parse_text_songs


def songs_to_candidates(
    *,
    songs: list[dict],
    source_type: str,
) -> list[CandidateTrack]:
    return [
        CandidateTrack(
            title=str(song.get("title", "") or ""),
            artist=str(song.get("artist", "") or ""),
            album=song.get("album") or "",
            score=idx + 1,
            source_type=source_type,
            source_seed_name=str(song.get("title", "") or ""),
            source_seed_artist=str(song.get("artist", "") or ""),
            rank_index=idx + 1,
            raw_payload=song,
        )
        for idx, song in enumerate(songs)
    ]


class PlaylistUrlSource(RecommendationSource):
    source_type = "playlist"
    playlist_type = "playlist"

    def __init__(
        self,
        context: SourceContext,
        *,
        url: str,
        api_base: str | None,
        timeout: float = 30.0,
    ):
        super().__init__(context)
        self.url = url
        self.api_base = api_base
        self.timeout = timeout
        self.parsed_name: str | None = None
        self.platform: str = "unknown"

    async def fetch_candidates(self) -> list[CandidateTrack]:
        parsed_name, platform, songs = await parse_playlist_url(
            self.url,
            api_base=self.api_base,
            timeout=self.timeout,
        )

        self.parsed_name = parsed_name
        self.platform = platform
        self.playlist_type = f"playlist_{platform}"
        self.source_type = self.playlist_type

        return songs_to_candidates(
            songs=songs,
            source_type=self.playlist_type,
        )

    async def default_playlist_name(self) -> str:
        return self.parsed_name or "第三方歌单"


class TextPlaylistSource(RecommendationSource):
    source_type = "playlist_text"
    playlist_type = "playlist_text"

    def __init__(
        self,
        context: SourceContext,
        *,
        text_content: str,
    ):
        super().__init__(context)
        self.text_content = text_content
        self.parsed_name: str | None = None
        self.platform: str = "text"

    async def fetch_candidates(self) -> list[CandidateTrack]:
        parsed_name, platform, songs = parse_text_songs(self.text_content)

        self.parsed_name = parsed_name
        self.platform = platform
        self.playlist_type = f"playlist_{platform}"
        self.source_type = self.playlist_type

        return songs_to_candidates(
            songs=songs,
            source_type=self.playlist_type,
        )

    async def default_playlist_name(self) -> str:
        return self.parsed_name or "文本歌单"


class IncrementalPlaylistSource(PlaylistUrlSource):
    source_type = "playlist_incremental"
    playlist_type = "playlist_incremental"

    async def fetch_candidates(self) -> list[CandidateTrack]:
        parsed_name, platform, songs = await parse_playlist_url(
            self.url,
            api_base=self.api_base,
            timeout=self.timeout,
        )

        self.parsed_name = parsed_name
        self.platform = platform
        self.raw_songs = songs

        return songs_to_candidates(
            songs=songs,
            source_type=self.source_type,
        )