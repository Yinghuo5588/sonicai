"""Persistent song library service — Phase 3."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import AsyncSessionLocal
from app.db.models import SongLibrary, SongTitleAlias, SongArtistAlias
from app.services.navidrome_native import get_all_songs_native
from app.utils.text_normalizer import (
    normalize_for_compare,
    normalize_artist,
    title_core,
    generate_title_aliases,
    generate_artist_aliases,
)

logger = logging.getLogger(__name__)


def _extract_song(raw: dict[str, Any]) -> dict | None:
    song_id = raw.get("id") or raw.get("songId") or raw.get("mediaFileId")
    title = raw.get("title") or raw.get("name")
    artist = raw.get("artist") or raw.get("artistName") or ""

    if isinstance(artist, dict):
        artist = artist.get("name") or ""

    album = raw.get("album") or raw.get("albumName") or None
    if isinstance(album, dict):
        album = album.get("name") or None

    duration = raw.get("duration")
    try:
        duration = int(duration) if duration is not None else None
    except Exception:
        duration = None

    if not song_id or not title:
        return None

    return {
        "navidrome_id": str(song_id),
        "title": str(title),
        "artist": str(artist or ""),
        "album": str(album or "") if album else None,
        "duration": duration,
    }


async def upsert_song_to_library(
    db: AsyncSession,
    raw_song: dict[str, Any],
    source: str = "sync",
) -> SongLibrary | None:
    """Insert or update a single song into song_library using ON CONFLICT."""
    parsed = _extract_song(raw_song)
    if not parsed:
        return None

    # Normalize fields
    title_norm = normalize_for_compare(parsed["title"])
    title_c = title_core(parsed["title"])
    artist_norm = normalize_artist(parsed["artist"])

    # PostgreSQL upsert via ON CONFLICT — avoids unique-key race conditions
    stmt = pg_insert(SongLibrary).values(
        navidrome_id=parsed["navidrome_id"],
        title=parsed["title"],
        artist=parsed["artist"],
        album=parsed["album"],
        duration=parsed["duration"],
        title_norm=title_norm,
        title_core=title_c,
        artist_norm=artist_norm,
        source=source,
        last_seen_at=datetime.now(timezone.utc),
    )
    do_update = {
        "title": stmt.excluded.title,
        "artist": stmt.excluded.artist,
        "album": stmt.excluded.album,
        "duration": stmt.excluded.duration,
        "title_norm": stmt.excluded.title_norm,
        "title_core": stmt.excluded.title_core,
        "artist_norm": stmt.excluded.artist_norm,
        "source": source,
        "last_seen_at": stmt.excluded.last_seen_at,
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["navidrome_id"],
        set_=do_update,
    )
    await db.execute(stmt)
    await db.flush()

    # Fetch the row (now guaranteed to exist)
    result = await db.execute(
        select(SongLibrary).where(SongLibrary.navidrome_id == parsed["navidrome_id"])
    )
    row = result.scalar_one()

    # Delete old aliases
    await db.execute(delete(SongTitleAlias).where(SongTitleAlias.song_id == row.id))
    await db.execute(delete(SongArtistAlias).where(SongArtistAlias.song_id == row.id))

    # Write title aliases
    for alias in generate_title_aliases(parsed["title"]):
        db.add(SongTitleAlias(song_id=row.id, alias=alias, alias_type="auto"))

    # Write artist aliases
    for alias in generate_artist_aliases(parsed["artist"]):
        db.add(SongArtistAlias(song_id=row.id, alias=alias, alias_type="auto"))

    return row


async def sync_navidrome_to_song_library() -> dict:
    """
    Full sync from Navidrome native API to SonicAI DB.
    Uses ON CONFLICT DO UPDATE so concurrent inserts are safe.
    """
    raw_songs = await get_all_songs_native()

    if not raw_songs:
        raise RuntimeError("Navidrome native song API returned empty data")

    count = 0

    async with AsyncSessionLocal() as db:
        for raw in raw_songs:
            row = await upsert_song_to_library(db, raw, source="sync")
            if row:
                count += 1

            if count % 500 == 0:
                await db.commit()
                logger.info("[song_library] synced %s songs", count)

        await db.commit()

    return {
        "total": count,
        "message": f"synced {count} songs",
    }


async def song_library_count() -> int:
    """Return current count of songs in song_library."""
    from sqlalchemy import func

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count(SongLibrary.id)))
        return int(result.scalar() or 0)