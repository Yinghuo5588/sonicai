"""In-memory hybrid song cache for Navidrome matching."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any

from rapidfuzz import fuzz

from app.services.navidrome_native import get_all_songs_native

logger = logging.getLogger(__name__)


def normalize_for_compare(value: str | None) -> str:
    """Normalize a string for fuzzy comparison."""
    if not value:
        return ""
    value = value.lower().strip()
    remove_chars = ["（", "）", "(", ")", "[", "]", "【", "】", "-", "_", ".", ",", "，", "。", "'", '"']
    for ch in remove_chars:
        value = value.replace(ch, " ")
    return " ".join(value.split())


@dataclass
class CacheSong:
    id: str
    title: str
    artist: str
    album: str | None = None
    duration: int | None = None
    source: str = "full"  # "full" | "passive"


class SongCache:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()

        # In-memory index
        self.songs: dict[str, CacheSong] = {}
        self.title_artist_index: dict[str, set[str]] = {}
        self.title_index: dict[str, set[str]] = {}
        self.artist_index: dict[str, set[str]] = {}

        # State
        self.enabled = True
        self.ready = False
        self.refreshing = False

        # Stats
        self.last_full_refresh: datetime | None = None
        self.last_error: str | None = None
        self.hits = 0
        self.misses = 0
        self.fallbacks = 0
        self.refresh_count = 0

    def _song_id(self, raw: dict[str, Any]) -> str | None:
        val = raw.get("id") or raw.get("songId") or raw.get("mediaFileId")
        return str(val) if val is not None else None

    def _title(self, raw: dict[str, Any]) -> str:
        return str(raw.get("title") or raw.get("name") or "")

    def _artist(self, raw: dict[str, Any]) -> str:
        artist = raw.get("artist")
        if isinstance(artist, dict):
            return str(artist.get("name") or "")
        if isinstance(artist, list) and artist:
            first = artist[0]
            if isinstance(first, dict):
                return str(first.get("name") or "")
            return str(first)
        return str(artist or raw.get("artistName") or "")

    def _album(self, raw: dict[str, Any]) -> str | None:
        album = raw.get("album")
        if isinstance(album, dict):
            return str(album.get("name") or "") or None
        return str(album or raw.get("albumName") or "") or None

    def _duration(self, raw: dict[str, Any]) -> int | None:
        val = raw.get("duration")
        try:
            return int(val) if val is not None else None
        except Exception:
            return None

    def _make_song(self, raw: dict[str, Any], source: str = "full") -> CacheSong | None:
        song_id = self._song_id(raw)
        title = self._title(raw)
        artist = self._artist(raw)
        if not song_id or not title:
            return None
        return CacheSong(
            id=song_id,
            title=title,
            artist=artist,
            album=self._album(raw),
            duration=self._duration(raw),
            source=source,
        )

    def _index_song_unlocked(self, song: CacheSong) -> None:
        self.songs[song.id] = song

        nt = normalize_for_compare(song.title)
        na = normalize_for_compare(song.artist)
        combo = f"{nt}::{na}"

        if nt:
            self.title_index.setdefault(nt, set()).add(song.id)
        if na:
            self.artist_index.setdefault(na, set()).add(song.id)
        if nt or na:
            self.title_artist_index.setdefault(combo, set()).add(song.id)

    def _clear_unlocked(self) -> None:
        self.songs.clear()
        self.title_artist_index.clear()
        self.title_index.clear()
        self.artist_index.clear()

    async def load_settings(self) -> None:
        """Load cache-enabled flag from DB settings."""
        try:
            from sqlalchemy import select
            from app.db.models import SystemSettings
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(SystemSettings))
                row = result.mappings().first()

            if row and "song_cache_enabled" in row:
                self.enabled = bool(row["song_cache_enabled"])
        except Exception as e:
            logger.warning("Failed to load cache settings from DB: %s", e)

    async def refresh_full(self) -> dict[str, Any]:
        """Trigger a full cache rebuild."""
        await self.load_settings()

        if not self.enabled:
            self.ready = False
            return self.status()

        if self.refreshing:
            return self.status()

        async with self._lock:
            self.refreshing = True
            self.last_error = None

            try:
                raw_songs = await get_all_songs_native()

                if not raw_songs:
                    raise RuntimeError("Navidrome native song API returned empty data")

                parsed: list[CacheSong] = []
                for raw in raw_songs:
                    song = self._make_song(raw, source="full")
                    if song:
                        parsed.append(song)

                self._clear_unlocked()
                for song in parsed:
                    self._index_song_unlocked(song)

                self.ready = True
                self.last_full_refresh = datetime.now(timezone.utc)
                self.refresh_count += 1

                logger.info("Song cache refreshed: %s songs", len(self.songs))
            except Exception as e:
                self.ready = False
                self.last_error = str(e)
                logger.exception("Song cache full refresh failed: %s", e)
            finally:
                self.refreshing = False

        return self.status()

    async def add_song(self, raw: dict[str, Any], source: str = "passive") -> None:
        """Passively add a song to the cache (after successful Subsonic search)."""
        song = self._make_song(raw, source=source)
        if not song:
            return
        async with self._lock:
            self._index_song_unlocked(song)

    def _candidate_ids(self, title: str, artist: str | None) -> set[str]:
        """Look up candidate song IDs from indexes."""
        nt = normalize_for_compare(title)
        na = normalize_for_compare(artist) if artist else ""

        ids: set[str] = set()

        if nt or na:
            ids.update(self.title_artist_index.get(f"{nt}::{na}", set()))

        if nt:
            ids.update(self.title_index.get(nt, set()))

        # Fuzzy fallback: if exact title lookup misses, scan title keys for high similarity
        if not ids and nt:
            for indexed_title, song_ids in self.title_index.items():
                score = fuzz.token_set_ratio(nt, indexed_title)
                if score >= 90:
                    ids.update(song_ids)

        return ids

    def match_one(
        self,
        title: str,
        artist: str | None = None,
        threshold: float = 0.75,
    ) -> dict[str, Any] | None:
        """Try to match a single track from the cache.

        Returns None if cache is disabled/unready or no good match found.
        Caller should fall back to Subsonic search in that case.
        """
        if not self.enabled or not self.ready:
            self.fallbacks += 1
            return None

        ids = self._candidate_ids(title, artist or "")

        if not ids:
            self.misses += 1
            return None

        nt = normalize_for_compare(title)
        na = normalize_for_compare(artist) if artist else ""

        best_song: CacheSong | None = None
        best_score = 0.0

        for song_id in ids:
            song = self.songs.get(song_id)
            if not song:
                continue

            title_score = fuzz.token_set_ratio(nt, normalize_for_compare(song.title)) / 100
            artist_score = 1.0
            if na:
                artist_score = fuzz.token_set_ratio(na, normalize_for_compare(song.artist)) / 100

            score = title_score * 0.72 + artist_score * 0.28

            if score > best_score:
                best_score = score
                best_song = song

        if best_song and best_score >= threshold:
            self.hits += 1
            return {
                **asdict(best_song),
                "score": best_score,
                "cache_hit": True,
            }

        self.misses += 1
        return None

    def status(self) -> dict[str, Any]:
        """Return current cache status and statistics."""
        total = self.hits + self.misses
        hit_rate = self.hits / total if total else 0
        return {
            "enabled": self.enabled,
            "ready": self.ready,
            "refreshing": self.refreshing,
            "total_songs": len(self.songs),
            "last_full_refresh": self.last_full_refresh.isoformat() if self.last_full_refresh else None,
            "last_error": self.last_error,
            "hits": self.hits,
            "misses": self.misses,
            "fallbacks": self.fallbacks,
            "hit_rate": hit_rate,
            "refresh_count": self.refresh_count,
        }


# Global singleton
song_cache = SongCache()