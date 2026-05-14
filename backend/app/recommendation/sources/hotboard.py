"""Hotboard recommendation source."""

from __future__ import annotations

from datetime import datetime, timezone

from app.recommendation.base import RecommendationSource, SourceContext
from app.recommendation.types import CandidateTrack
from app.services.hotboard_service import fetch_netease_hotboard


class HotboardSource(RecommendationSource):
    source_type = "hotboard"
    playlist_type = "hotboard"

    display_name = "网易云热榜"
    description = "从网易云热榜抓取热门歌曲并同步到 Navidrome 歌单。"
    is_dynamic = False
    supported_playlist_types = ("hotboard",)

    def __init__(self, context: SourceContext, *, limit: int = 50):
        super().__init__(context)
        self.limit = max(1, min(200, int(limit or 50)))

    async def default_playlist_name(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"网易云热榜 - {today}"

    async def fetch_candidates(self) -> list[CandidateTrack]:
        hot_tracks = await fetch_netease_hotboard(limit=self.limit)

        return [
            CandidateTrack(
                title=str(t.get("title", "") or ""),
                artist=str(t.get("artist", "") or ""),
                album=t.get("album") or "",
                score=t.get("index") or idx + 1,
                source_type=self.source_type,
                source_seed_name=str(t.get("title", "") or ""),
                source_seed_artist=str(t.get("artist", "") or ""),
                rank_index=idx + 1,
                raw_payload=t,
            )
            for idx, t in enumerate(hot_tracks)
        ]