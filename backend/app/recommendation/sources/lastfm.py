"""Last.fm recommendation sources."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Awaitable, Callable

from app.recommendation.base import RecommendationSource, SourceContext
from app.recommendation.types import CandidateTrack
from app.services.lastfm_service import (
    get_user_top_tracks,
    get_user_top_artists,
    get_user_recent_tracks,
    get_similar_tracks,
    get_similar_artists,
    get_artist_top_tracks,
)
from app.utils.text_normalizer import dedup_key

logger = logging.getLogger(__name__)


StopChecker = Callable[[], Awaitable[bool]]


async def _default_stop_checker() -> bool:
    return False


class LastfmSimilarTracksSource(RecommendationSource):
    source_type = "track_similarity"
    playlist_type = "similar_tracks"

    display_name = "Last.fm 相似曲目"
    description = "基于用户最近播放或 Top Tracks，从 Last.fm 获取相似曲目候选。"
    is_dynamic = False
    supported_playlist_types = ("similar_tracks",)

    def __init__(
        self,
        context: SourceContext,
        *,
        settings,
        stop_checker: StopChecker | None = None,
    ):
        super().__init__(context)
        self.settings = settings
        self.stop_checker = stop_checker or _default_stop_checker

    async def default_playlist_name(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"LastFM - 相似曲目 - {today}"

    async def _build_seed_tracks(self) -> list[dict]:
        settings = self.settings

        seed_mode = getattr(settings, "seed_source_mode", "recent_plus_top") or "recent_plus_top"
        seed_limit = int(settings.top_track_seed_limit or 8)

        if seed_mode == "recent_only":
            recent_limit = getattr(settings, "recent_tracks_limit", 100) or 100
            recent_tracks = await get_user_recent_tracks(
                settings.lastfm_username,
                limit=recent_limit,
            )

            recent_counter: dict[tuple[str, str], int] = {}

            for t in recent_tracks:
                title = t.get("name", "")
                artist = (
                    t.get("artist", {}).get("name", "")
                    if isinstance(t.get("artist"), dict)
                    else (t.get("artist", {}) or "")
                )

                if title and artist:
                    key = (title.lower(), artist.lower())
                    recent_counter[key] = recent_counter.get(key, 0) + 1

            sorted_recent = sorted(
                recent_counter.items(),
                key=lambda x: x[1],
                reverse=True,
            )

            return [
                {
                    "name": k[0],
                    "artist": {"name": k[1]},
                    "play_count": v,
                }
                for k, v in sorted_recent[:seed_limit]
            ]

        if seed_mode == "top_only":
            period = getattr(settings, "top_period", "1month") or "1month"
            top_tracks = await get_user_top_tracks(
                settings.lastfm_username,
                limit=seed_limit,
                period=period,
            )
            return [t for t in top_tracks if t.get("name") and t.get("artist")]

        # default: recent_plus_top
        recent_limit = getattr(settings, "recent_tracks_limit", 100) or 100
        recent_tracks = await get_user_recent_tracks(
            settings.lastfm_username,
            limit=recent_limit,
        )

        recent_counter: dict[tuple[str, str], int] = {}

        for t in recent_tracks:
            title = t.get("name", "")
            artist = (
                t.get("artist", {}).get("name", "")
                if isinstance(t.get("artist"), dict)
                else (t.get("artist", {}) or "")
            )

            if title and artist:
                key = (title.lower(), artist.lower())
                recent_counter[key] = recent_counter.get(key, 0) + 1

        sorted_recent = sorted(
            recent_counter.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        recent_ratio = (getattr(settings, "recent_top_mix_ratio", 70) or 70) / 100.0
        target_recent = int(seed_limit * recent_ratio)

        recent_seeds = [
            {
                "name": k[0],
                "artist": {"name": k[1]},
                "play_count": v,
            }
            for k, v in sorted_recent[:target_recent]
        ]

        remaining = seed_limit - len(recent_seeds)
        seeds = list(recent_seeds)

        if remaining > 0:
            period = getattr(settings, "top_period", "1month") or "1month"
            top_tracks = await get_user_top_tracks(
                settings.lastfm_username,
                limit=seed_limit,
                period=period,
            )

            existing_keys = {
                (
                    s["name"].lower(),
                    s["artist"]["name"].lower()
                    if isinstance(s["artist"], dict)
                    else "",
                )
                for s in recent_seeds
            }

            for t in top_tracks:
                title = t.get("name", "")
                artist = (
                    t.get("artist", {}).get("name", "")
                    if isinstance(t.get("artist"), dict)
                    else ""
                )

                if title and artist and (title.lower(), artist.lower()) not in existing_keys:
                    seeds.append(t)
                    existing_keys.add((title.lower(), artist.lower()))

                if len(seeds) >= seed_limit:
                    break

        return seeds

    async def fetch_candidates(self) -> list[CandidateTrack]:
        settings = self.settings

        seeds = await self._build_seed_tracks()
        logger.info("[lastfm-similar-tracks-source] seeds=%s", len(seeds))

        balance = float(settings.recommendation_balance or 55) / 100.0
        min_mult = float(getattr(settings, "candidate_pool_multiplier_min", 2.0) or 2.0)
        max_mult = float(getattr(settings, "candidate_pool_multiplier_max", 10.0) or 10.0)

        target_size = int(settings.similar_playlist_size or 30)
        candidate_pool_size = int(target_size * (min_mult + balance * (max_mult - min_mult)))

        seed_limit = int(settings.top_track_seed_limit or 8)

        candidates: list[CandidateTrack] = []
        seen_keys = set()

        for seed in seeds[:seed_limit]:
            if await self.stop_checker():
                logger.info("[lastfm-similar-tracks-source] stopped")
                return candidates

            seed_title = seed.get("name", "")
            seed_artist = (
                seed.get("artist", {}).get("name", "")
                if isinstance(seed.get("artist"), dict)
                else (seed.get("artist", {}) or "")
            )

            if not seed_title or not seed_artist:
                continue

            similar = await get_similar_tracks(
                seed_title,
                seed_artist,
                limit=int(settings.similar_track_limit or 30),
            )

            for track in similar:
                title = track.get("name", "")
                artist = (
                    track.get("artist", {}).get("name", "")
                    if isinstance(track.get("artist"), dict)
                    else ""
                )

                if not title or not artist:
                    continue

                key = dedup_key(title, artist)
                if key in seen_keys:
                    continue

                seen_keys.add(key)

                album = (
                    track.get("album", {}).get("#text", "")
                    if isinstance(track.get("album"), dict)
                    else ""
                )

                candidates.append(
                    CandidateTrack(
                        title=title,
                        artist=artist,
                        album=album,
                        score=float(track.get("match", 0) or 0),
                        source_type=self.source_type,
                        source_seed_name=seed_title,
                        source_seed_artist=seed_artist,
                        raw_payload=track,
                    )
                )

        candidates.sort(key=lambda c: float(c.score or 0), reverse=True)
        candidates = candidates[:candidate_pool_size]

        logger.info(
            "[lastfm-similar-tracks-source] candidates=%s pool_size=%s",
            len(candidates),
            candidate_pool_size,
        )

        return candidates


class LastfmSimilarArtistsSource(RecommendationSource):
    source_type = "artist_similarity"
    playlist_type = "similar_artists"

    display_name = "Last.fm 相似艺术家"
    description = "基于用户最近播放或 Top Artists，从 Last.fm 获取相似艺术家及其热门曲目。"
    is_dynamic = False
    supported_playlist_types = ("similar_artists",)

    def __init__(
        self,
        context: SourceContext,
        *,
        settings,
        exclude_dedup_keys: set[str] | None = None,
        stop_checker: StopChecker | None = None,
    ):
        super().__init__(context)
        self.settings = settings
        self.exclude_dedup_keys = exclude_dedup_keys or set()
        self.stop_checker = stop_checker or _default_stop_checker

    async def default_playlist_name(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"LastFM - 相似艺术家 - {today}"

    async def _build_seed_artists(self) -> list[dict]:
        settings = self.settings
        top_artist_seed_limit = int(settings.top_artist_seed_limit or 30)

        recent_tracks = await get_user_recent_tracks(
            settings.lastfm_username,
            limit=100,
        )

        artist_counter: dict[str, int] = {}

        for t in recent_tracks:
            artist = (
                t.get("artist", {}).get("name", "")
                if isinstance(t.get("artist"), dict)
                else (t.get("artist", {}) or "")
            )

            if artist:
                artist_counter[artist.lower()] = artist_counter.get(artist.lower(), 0) + 1

        sorted_recent_artists = sorted(
            artist_counter.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        recent_seed_artists = [
            {
                "name": a[0].title(),
                "play_count": a[1],
            }
            for a in sorted_recent_artists[:top_artist_seed_limit]
        ]

        if len(recent_seed_artists) < top_artist_seed_limit:
            period = getattr(settings, "top_period", "1month") or "1month"
            top_artists = await get_user_top_artists(
                settings.lastfm_username,
                limit=top_artist_seed_limit,
                period=period,
            )

            existing = {a["name"].lower() for a in recent_seed_artists}

            for a in top_artists:
                name = a.get("name", "")
                if name and name.lower() not in existing:
                    recent_seed_artists.append(a)
                    existing.add(name.lower())

                if len(recent_seed_artists) >= top_artist_seed_limit:
                    break

        return recent_seed_artists

    async def fetch_candidates(self) -> list[CandidateTrack]:
        settings = self.settings

        seed_artists = await self._build_seed_artists()
        logger.info("[lastfm-similar-artists-source] seeds=%s", len(seed_artists))

        seen_keys = set(self.exclude_dedup_keys)
        candidates: list[CandidateTrack] = []

        top_artist_seed_limit = int(settings.top_artist_seed_limit or 30)
        similar_artist_limit = int(settings.similar_artist_limit or 30)
        artist_top_track_limit = int(settings.artist_top_track_limit or 2)

        for seed in seed_artists[:top_artist_seed_limit]:
            if await self.stop_checker():
                logger.info("[lastfm-similar-artists-source] stopped")
                return candidates

            seed_name = seed.get("name", "")
            if not seed_name:
                continue

            similar = await get_similar_artists(
                seed_name,
                limit=similar_artist_limit,
            )

            for artist in similar[:similar_artist_limit]:
                artist_name = artist.get("name", "")
                if not artist_name:
                    continue

                artist_match = float(artist.get("match", 0.0) or 0.0)

                tracks = await get_artist_top_tracks(
                    artist_name,
                    limit=artist_top_track_limit,
                )

                for track in tracks:
                    title = track.get("name", "")
                    if not title:
                        continue

                    track_artist = (
                        track.get("artist", {}).get("name", "")
                        if isinstance(track.get("artist"), dict)
                        else ""
                    )

                    if not track_artist:
                        track_artist = artist_name

                    album = (
                        track.get("album", {}).get("#text", "")
                        if isinstance(track.get("album"), dict)
                        else ""
                    )

                    key = dedup_key(title, track_artist)
                    if key in seen_keys:
                        continue

                    seen_keys.add(key)

                    candidates.append(
                        CandidateTrack(
                            title=title,
                            artist=track_artist,
                            album=album,
                            score=artist_match,
                            source_type=self.source_type,
                            source_seed_name=seed_name,
                            source_seed_artist=artist_name,
                            raw_payload=track,
                        )
                    )

        candidates.sort(key=lambda c: float(c.score or 0), reverse=True)
        candidates = candidates[: int(settings.artist_playlist_size or 30)]

        logger.info(
            "[lastfm-similar-artists-source] candidates=%s",
            len(candidates),
        )

        return candidates