"""Database-backed unified matching pipeline.

Final chain:
  manual_match -> match_cache -> memory index
  -> database alias exact -> database fuzzy
  -> Subsonic search3 (last resort)

All successful matches are written back to:
  song_library, alias tables, match_cache, memory index.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.db.session import AsyncSessionLocal
from app.db.models import (
    SongLibrary,
    SongTitleAlias,
    SongArtistAlias,
    MatchCache,
    ManualMatch,
    MatchLog,
)
from app.services.song_cache import song_cache
from app.services.navidrome_service import navidrome_multi_search
from app.services.matching_service import pick_best_match
from app.utils.text_normalizer import (
    normalize_for_compare,
    normalize_artist,
    generate_title_aliases,
    generate_artist_aliases,
    score_candidate,
)

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _format_song_match(song: SongLibrary, score: float, source: str) -> dict[str, Any]:
    return {
        "id": song.navidrome_id,
        "title": song.title,
        "artist": song.artist or "",
        "album": song.album,
        "duration": song.duration,
        "score": float(score),
        "source": source,
    }


async def _find_manual_match(title: str, artist: str) -> dict | None:
    """Step 1: Check manual_match table."""
    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ManualMatch).where(
                ManualMatch.input_title_norm == title_norm,
                ManualMatch.input_artist_norm == artist_norm,
            )
        )
        row = result.scalar_one_or_none()

        if not row or not row.navidrome_id:
            return None

        song_result = await db.execute(
            select(SongLibrary).where(SongLibrary.navidrome_id == row.navidrome_id)
        )
        song = song_result.scalar_one_or_none()

        if song:
            return _format_song_match(song, 1.0, "manual")

        return {
            "id": row.navidrome_id,
            "title": title,
            "artist": artist or "",
            "album": None,
            "duration": None,
            "score": 1.0,
            "source": "manual",
        }


async def _find_match_cache(title: str, artist: str, threshold: float) -> dict | None:
    """Step 2: Check match_cache table."""
    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MatchCache).where(
                MatchCache.input_title_norm == title_norm,
                MatchCache.input_artist_norm == artist_norm,
            )
        )
        row = result.scalar_one_or_none()

        if not row:
            return None

        if row.confidence_score is not None and float(row.confidence_score) < threshold:
            return None

        if row.song_id:
            song = await db.get(SongLibrary, row.song_id)
            if song:
                return _format_song_match(song, float(row.confidence_score or 1.0), "match_cache")

        if row.navidrome_id:
            return {
                "id": row.navidrome_id,
                "title": title,
                "artist": artist or "",
                "album": None,
                "duration": None,
                "score": float(row.confidence_score or 1.0),
                "source": "match_cache",
            }

        return None


async def _find_db_alias_match(title: str, artist: str, threshold: float) -> dict | None:
    """Step 4: Database alias exact search."""
    title_aliases = generate_title_aliases(title)
    artist_aliases = generate_artist_aliases(artist)

    if not title_aliases:
        return None

    async with AsyncSessionLocal() as db:
        # Title alias hits
        title_result = await db.execute(
            select(SongTitleAlias.song_id).where(SongTitleAlias.alias.in_(title_aliases))
        )
        title_song_ids = {r[0] for r in title_result.fetchall() if r[0]}

        if not title_song_ids:
            return None

        candidate_ids = title_song_ids

        # Filter by artist alias if available
        if artist_aliases:
            artist_result = await db.execute(
                select(SongArtistAlias.song_id).where(SongArtistAlias.alias.in_(artist_aliases))
            )
            artist_song_ids = {r[0] for r in artist_result.fetchall() if r[0]}
            if artist_song_ids:
                candidate_ids = title_song_ids & artist_song_ids

        if not candidate_ids:
            candidate_ids = title_song_ids

        songs_result = await db.execute(
            select(SongLibrary).where(SongLibrary.id.in_(candidate_ids)).limit(50)
        )
        songs = songs_result.scalars().all()

        best = None
        best_score = 0.0

        for song in songs:
            scores = score_candidate(
                title, artist,
                song.title or "", song.artist or "",
            )
            score = scores["score"]

            if score > best_score:
                best_score = score
                best = song

        if best and best_score >= threshold:
            return _format_song_match(best, best_score, "db_alias")

        return None


async def _find_db_fuzzy_match(title: str, artist: str, threshold: float) -> dict | None:
    """Step 5: PostgreSQL pg_trgm fuzzy search (requires pg_trgm extension)."""
    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist)

    if not title_norm:
        return None

    async with AsyncSessionLocal() as db:
        sql = text("""
            SELECT
                id, navidrome_id, title, artist, album, duration, source,
                GREATEST(
                    similarity(COALESCE(title_norm, ''), :title_norm),
                    similarity(COALESCE(title_core, ''), :title_norm)
                ) AS title_sim,
                similarity(COALESCE(artist_norm, ''), :artist_norm) AS artist_sim
            FROM song_library
            WHERE
                COALESCE(title_norm, '') % :title_norm
                OR COALESCE(title_core, '') % :title_norm
                OR COALESCE(artist_norm, '') % :artist_norm
            ORDER BY (
                GREATEST(
                    similarity(COALESCE(title_norm, ''), :title_norm),
                    similarity(COALESCE(title_core, ''), :title_norm)
                ) * 0.75
                + similarity(COALESCE(artist_norm, ''), :artist_norm) * 0.25
            ) DESC
            LIMIT 50
        """)

        result = await db.execute(
            sql,
            {"title_norm": title_norm, "artist_norm": artist_norm},
        )
        rows = result.mappings().all()

        best = None
        best_score = 0.0

        for row in rows:
            scores = score_candidate(
                title, artist,
                row["title"] or "", row["artist"] or "",
            )
            score = scores["score"]

            if score > best_score:
                best_score = score
                best = row

        if best and best_score >= threshold:
            return {
                "id": best["navidrome_id"],
                "title": best["title"],
                "artist": best["artist"],
                "album": best["album"],
                "duration": best["duration"],
                "score": best_score,
                "source": "db_fuzzy",
            }

        return None


async def _write_match_cache(title: str, artist: str, match: dict, source: str) -> None:
    """Write a successful match into match_cache (idempotent)."""
    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MatchCache).where(
                MatchCache.input_title_norm == title_norm,
                MatchCache.input_artist_norm == artist_norm,
            )
        )
        row = result.scalar_one_or_none()

        if not row:
            row = MatchCache(
                input_title=title,
                input_artist=artist,
                input_title_norm=title_norm,
                input_artist_norm=artist_norm,
            )
            db.add(row)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(
                    select(MatchCache).where(
                        MatchCache.input_title_norm == title_norm,
                        MatchCache.input_artist_norm == artist_norm,
                    )
                )
                row = result.scalar_one_or_none()
                if not row:
                    return

        row.navidrome_id = match.get("id")
        row.confidence_score = match.get("score")
        row.source = source

        if match.get("id"):
            song_result = await db.execute(
                select(SongLibrary).where(SongLibrary.navidrome_id == str(match["id"]))
            )
            song = song_result.scalar_one_or_none()
            if song:
                row.song_id = song.id

        await db.commit()


async def _write_match_log(
    title: str, artist: str, match: dict | None, source: str
) -> None:
    """Append a record to match_log."""
    async with AsyncSessionLocal() as db:
        db.add(MatchLog(
            input_title=title,
            input_artist=artist,
            matched=bool(match),
            navidrome_id=match.get("id") if match else None,
            selected_title=match.get("title") if match else None,
            selected_artist=match.get("artist") if match else None,
            confidence_score=match.get("score") if match else None,
            source=source,
            raw_json=json.dumps(match, ensure_ascii=False) if match else None,
        ))
        await db.commit()


# ── Main entry point ────────────────────────────────────────────────────────────

async def match_track(
    title: str,
    artist: str,
    threshold: float = 0.75,
) -> dict | None:
    """
    Unified matching chain.
    Returns a dict with id/title/artist/album/duration/score/source or None.
    """
    # 1. manual_match
    manual = await _find_manual_match(title, artist)
    if manual:
        await _write_match_log(title, artist, manual, "manual")
        return manual

    # 2. match_cache
    cached = await _find_match_cache(title, artist, threshold)
    if cached:
        await _write_match_log(title, artist, cached, "match_cache")
        return cached

    # 3. memory index
    memory = song_cache.match_one(title=title, artist=artist, threshold=threshold)
    if memory:
        memory["source"] = "memory"
        await _write_match_cache(title, artist, memory, "memory")
        await _write_match_log(title, artist, memory, "memory")
        return memory

    # 4. database alias exact search
    db_match = await _find_db_alias_match(title, artist, threshold)
    if db_match:
        await _write_match_cache(title, artist, db_match, "db_alias")
        await _write_match_log(title, artist, db_match, "db_alias")
        return db_match

    # 5. database fuzzy search (pg_trgm)
    db_fuzzy = await _find_db_fuzzy_match(title, artist, threshold)
    if db_fuzzy:
        await _write_match_cache(title, artist, db_fuzzy, "db_fuzzy")
        await _write_match_log(title, artist, db_fuzzy, "db_fuzzy")
        return db_fuzzy

    # 6. Subsonic fallback
    nav_results = await navidrome_multi_search(title, artist)
    best = pick_best_match(title, artist, nav_results, threshold)

    if best and best.get("id"):
        # Write back to song_library + memory
        from app.services.song_library_service import upsert_song_to_library

        async with AsyncSessionLocal() as db:
            await upsert_song_to_library(
                db,
                {
                    "id": best.get("id"),
                    "title": best.get("title"),
                    "artist": best.get("artist"),
                    "album": best.get("album"),
                    "duration": best.get("duration"),
                },
                source="passive",
            )
            await db.commit()

        await song_cache.add_song(
            {
                "id": best.get("id"),
                "title": best.get("title"),
                "artist": best.get("artist"),
                "album": best.get("album"),
                "duration": best.get("duration"),
            },
            source="passive",
        )

        best["source"] = "subsonic"
        await _write_match_cache(title, artist, best, "subsonic")
        await _write_match_log(title, artist, best, "subsonic")
        return best

    await _write_match_log(title, artist, None, "miss")
    return None