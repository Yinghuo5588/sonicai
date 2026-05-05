"""Database-backed unified matching pipeline.

Final chain:
  manual_match -> match_cache -> memory index
  -> database alias exact -> database fuzzy
  -> Subsonic search3 (last resort)

All successful matches are written back to:
  song_library, alias tables, match_cache, memory index.

Debug mode:
  Set SystemSettings.match_debug_enabled=True to record full chain steps
  in match_log.raw_json.  Or call match_track_debug() directly for one-shot
  diagnostics without changing system settings.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
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

# ── MatchConfig ─────────────────────────────────────────────────────────────────

@dataclass
class MatchConfig:
    """
    Unified matching configuration used by all data-source modules.

    Attributes:
        threshold:      Minimum score to accept a match (default 0.75).
        force_mode:     Override match_mode setting:
                          "local"  = skip Subsonic (local-only)
                          "api"    = Subsonic only (skip local steps)
                          "full"   = local + Subsonic (default chain)
                          None     = respect match_mode from SystemSettings
        concurrency:    Max concurrent matches in batch mode (default 5, clamped 1-20).
        write_cache:    Write successful matches to match_cache & memory index (default True).
                        Set False when retrying to avoid duplicate writes.
        record_miss:    Record unmatched tracks to missed_track table (default True).
                        Set False for retry operations that should not re-trigger miss tracking.
    """
    threshold: float = 0.75
    force_mode: str | None = None        # "local" | "api" | "full" | None
    concurrency: int = 5
    write_cache: bool = True
    record_miss: bool = True

    @classmethod
    async def from_settings(cls, mode_override: str | None = None) -> "MatchConfig":
        """
        Load configuration from SystemSettings.
        mode_override is used by retry/etc modules to force a specific mode
        regardless of what the global setting says.
        """
        try:
            from app.db.models import SystemSettings

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(SystemSettings))
                row = result.scalar_one_or_none()
                if not row:
                    return cls()

                match_mode = mode_override or str(row.match_mode or "full")

                return cls(
                    threshold=float(row.match_threshold) if row.match_threshold is not None else 0.75,
                    force_mode=mode_override or None,
                    concurrency=max(1, min(20, int(row.search_concurrency or 5))),
                    write_cache=True,
                    record_miss=True,
                )
        except Exception:
            return cls()


# ── Config helpers ─────────────────────────────────────────────────────────────

async def _get_match_mode() -> str:
    """Query SystemSettings.match_mode.
    Returns "local", "api", or "full".
    Handles legacy "local_only" -> "local" and "full" -> "full".
    """
    try:
        from app.db.models import SystemSettings

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            row = result.scalar_one_or_none()
            if row and getattr(row, "match_mode", None):
                raw = str(row.match_mode)
                if raw == "local_only":
                    return "local"
                return raw  # "full" or newer values
    except Exception:
        pass
    return "full"


async def _get_retry_mode() -> str:
    """Query SystemSettings.missed_track_retry_mode."""
    try:
        from app.db.models import SystemSettings

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            row = result.scalar_one_or_none()
            if row and getattr(row, "missed_track_retry_mode", None):
                return str(row.missed_track_retry_mode)
    except Exception:
        pass
    return "local"


# ── Miss helpers ───────────────────────────────────────────────────────────────

async def _record_miss(
    title: str,
    artist: str,
    threshold: float,
    source: str | None,
) -> None:
    try:
        from app.services.missed_track_service import record_missed_track
        await record_missed_track(
            title=title,
            artist=artist,
            threshold=threshold,
            source=source,
        )
    except Exception:
        logger.exception("Failed to record missed track: %s - %s", title, artist)


logger = logging.getLogger(__name__)


# ── Debug helpers ───────────────────────────────────────────────────────────────

async def _is_debug_enabled() -> bool:
    """Query SystemSettings.match_debug_enabled."""
    try:
        from app.db.models import SystemSettings

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SystemSettings))
            row = result.scalar_one_or_none()
            if row and getattr(row, "match_debug_enabled", False):
                return True
    except Exception:
        pass
    return False


def _step_info(
    *,
    step: str,
    hit: bool,
    candidates_count: int = 0,
    best_score: float | None = None,
    best_candidate: dict | None = None,
    top_candidates: list[dict] | None = None,
    duration_ms: float | None = None,
    threshold: float | None = None,
    error: str | None = None,
    **extra,
) -> dict:
    info = {
        "step": step,
        "hit": hit,
        "candidates_count": candidates_count,
        "best_score": round(best_score, 4) if best_score is not None else None,
        "threshold": threshold,
        "duration_ms": round(duration_ms, 2) if duration_ms is not None else None,
        "top_candidates": top_candidates or [],
        "error": error,
    }
    if best_candidate and not info["top_candidates"]:
        info["best_candidate"] = best_candidate
    info.update(extra)
    return info


# ── Internal matchers ───────────────────────────────────────────────────────────

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


async def _find_db_alias_match(
    title: str,
    artist: str,
    threshold: float,
    debug: bool = False,
) -> tuple[dict | None, dict | None]:
    """Step 4: Database alias exact search.

    Returns (match, step_info).  step_info is None when debug=False.
    """
    title_aliases = generate_title_aliases(title)
    artist_aliases = generate_artist_aliases(artist)

    step: dict | None = (
        {
            "step": "db_alias",
            "hit": False,
            "threshold": threshold,
            "candidates_count": 0,
            "best_score": None,
            "best_candidate": None,
            "top_candidates": [],
            "title_aliases": sorted(title_aliases),
            "artist_aliases": sorted(artist_aliases),
        }
        if debug
        else None
    )

    if not title_aliases:
        return None, step

    async with AsyncSessionLocal() as db:
        # Title alias hits
        title_result = await db.execute(
            select(SongTitleAlias.song_id).where(SongTitleAlias.alias.in_(title_aliases))
        )
        title_song_ids = {r[0] for r in title_result.fetchall() if r[0]}

        if not title_song_ids:
            return None, step

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

        scored_candidates = []
        best = None
        best_score = 0.0

        for song in songs:
            scores = score_candidate(
                title, artist,
                song.title or "", song.artist or "",
            )
            score = scores["score"]

            candidate = {
                "id": song.navidrome_id,
                "title": song.title,
                "artist": song.artist or "",
                "album": song.album,
                "duration": song.duration,
                "score": score,
                "title_score": scores["title_score"],
                "title_core_score": scores["title_core_score"],
                "artist_score": scores["artist_score"],
            }
            scored_candidates.append(candidate)

            if score > best_score:
                best_score = score
                best = song

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)

        if debug and step is not None:
            step["candidates_count"] = len(scored_candidates)
            step["top_candidates"] = scored_candidates[:5]
            step["best_score"] = scored_candidates[0]["score"] if scored_candidates else None
            step["best_candidate"] = scored_candidates[0] if scored_candidates else None

        if best and best_score >= threshold:
            result = _format_song_match(best, best_score, "db_alias")
            if debug and step is not None:
                step["hit"] = True
            return result, step

        return None, step


async def _find_db_fuzzy_match(
    title: str,
    artist: str,
    threshold: float,
    debug: bool = False,
) -> tuple[dict | None, dict | None]:
    """Step 5: PostgreSQL pg_trgm fuzzy search.

    Returns (match, step_info).  step_info is None when debug=False.
    """
    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist)

    step: dict | None = (
        {
            "step": "db_fuzzy",
            "hit": False,
            "threshold": threshold,
            "candidates_count": 0,
            "best_score": None,
            "best_candidate": None,
            "top_candidates": [],
            "title_norm": title_norm,
            "artist_norm": artist_norm,
        }
        if debug
        else None
    )

    if not title_norm:
        return None, step

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

        scored_candidates = []
        best = None
        best_score = 0.0

        for row in rows:
            scores = score_candidate(
                title, artist,
                row["title"] or "", row["artist"] or "",
            )
            score = scores["score"]

            candidate = {
                "id": row["navidrome_id"],
                "title": row["title"],
                "artist": row["artist"],
                "album": row["album"],
                "duration": row["duration"],
                "score": score,
                "title_score": scores["title_score"],
                "title_core_score": scores["title_core_score"],
                "artist_score": scores["artist_score"],
                "pg_title_sim": float(row["title_sim"] or 0),
                "pg_artist_sim": float(row["artist_sim"] or 0),
            }
            scored_candidates.append(candidate)

            if score > best_score:
                best_score = score
                best = row

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)

        if debug and step is not None:
            step["candidates_count"] = len(scored_candidates)
            step["top_candidates"] = scored_candidates[:5]
            step["best_score"] = scored_candidates[0]["score"] if scored_candidates else None
            step["best_candidate"] = scored_candidates[0] if scored_candidates else None

        if best and best_score >= threshold:
            matched = {
                "id": best["navidrome_id"],
                "title": best["title"],
                "artist": best["artist"],
                "album": best["album"],
                "duration": best["duration"],
                "score": best_score,
                "source": "db_fuzzy",
            }
            if debug and step is not None:
                step["hit"] = True
            return matched, step

        return None, step


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
    title: str,
    artist: str,
    match: dict | None,
    source: str,
    debug_steps: list[dict] | None = None,
) -> None:
    """Append a record to match_log.

    When debug_steps is provided, raw_json stores the full trace.
    """
    async with AsyncSessionLocal() as db:
        if debug_steps:
            raw_json = json.dumps(
                {"result": match, "steps": debug_steps},
                ensure_ascii=False,
            )
        else:
            raw_json = json.dumps(match, ensure_ascii=False) if match else None

        db.add(
            MatchLog(
                input_title=title,
                input_artist=artist,
                matched=bool(match),
                navidrome_id=match.get("id") if match else None,
                selected_title=match.get("title") if match else None,
                selected_artist=match.get("artist") if match else None,
                confidence_score=match.get("score") if match else None,
                source=source,
                raw_json=raw_json,
            )
        )
        await db.commit()


# ── Core internal matcher ──────────────────────────────────────────────────────

async def _match_track_internal(
    title: str,
    artist: str,
    threshold: float = 0.75,
    force_debug: bool = False,
    force_mode: str | None = None,
) -> tuple[dict | None, list[dict] | None]:
    """
    Internal implementation of the full matching chain.
    Returns (match, steps).  steps is None when debug is disabled.

    Args:
        force_mode: override the match_mode setting for this call.
            "local" -> skip Subsonic entirely (local-only)
            "api"   -> skip local steps and call Subsonic directly
            "full"  -> run the full local+Subsonic chain
            None    -> use the match_mode setting from the database
    """
    debug_enabled = force_debug or await _is_debug_enabled()
    steps: list[dict] | None = [] if debug_enabled else None

    # ── Step 1: manual_match ────────────────────────────────────────────────
    t0 = time.time()
    manual = await _find_manual_match(title, artist)

    if debug_enabled and steps is not None:
        steps.append(
            _step_info(
                step="manual_match",
                hit=manual is not None,
                candidates_count=1 if manual else 0,
                best_score=manual.get("score") if manual else None,
                best_candidate=manual,
                duration_ms=round((time.time() - t0) * 1000, 2),
                threshold=threshold,
            )
        )

    if manual:
        await _write_match_log(title, artist, manual, "manual", steps)
        return manual, steps

    # ── Step 2: match_cache ────────────────────────────────────────────────
    t0 = time.time()
    cached = await _find_match_cache(title, artist, threshold)

    if debug_enabled and steps is not None:
        steps.append(
            _step_info(
                step="match_cache",
                hit=cached is not None,
                candidates_count=1 if cached else 0,
                best_score=cached.get("score") if cached else None,
                best_candidate=cached,
                duration_ms=round((time.time() - t0) * 1000, 2),
                threshold=threshold,
            )
        )

    if cached:
        await _write_match_log(title, artist, cached, "match_cache", steps)
        return cached, steps

    # ── Step 3: memory index ───────────────────────────────────────────────
    t0 = time.time()
    memory = song_cache.match_one(title=title, artist=artist, threshold=threshold)

    if debug_enabled and steps is not None:
        # Collect top candidates from memory index using internal helper
        try:
            candidate_ids = song_cache._candidate_ids(title, artist or "")
        except AttributeError:
            candidate_ids = []

        memory_candidates = []
        for cid in list(candidate_ids)[:50]:
            song = song_cache.songs.get(cid)
            if not song:
                continue
            scores = score_candidate(title, artist or "", song.title, song.artist)
            memory_candidates.append(
                {
                    "id": song.id,
                    "title": song.title,
                    "artist": song.artist,
                    "album": song.album,
                    "duration": song.duration,
                    "score": scores["score"],
                    "title_score": scores["title_score"],
                    "title_core_score": scores["title_core_score"],
                    "artist_score": scores["artist_score"],
                }
            )
        memory_candidates.sort(key=lambda x: x["score"], reverse=True)

        steps.append(
            _step_info(
                step="memory",
                hit=memory is not None,
                candidates_count=len(candidate_ids),
                best_score=(
                    memory["score"]
                    if memory
                    else memory_candidates[0]["score"]
                    if memory_candidates
                    else None
                ),
                best_candidate=memory or (
                    memory_candidates[0] if memory_candidates else None
                ),
                top_candidates=memory_candidates[:5],
                duration_ms=round((time.time() - t0) * 1000, 2),
                threshold=threshold,
            )
        )

    if memory:
        memory["source"] = "memory"
        await _write_match_cache(title, artist, memory, "memory")
        await _write_match_log(title, artist, memory, "memory", steps)
        return memory, steps

    # ── Step 4: database alias exact search ────────────────────────────────
    t0 = time.time()
    db_match, db_alias_step = await _find_db_alias_match(
        title, artist, threshold, debug=debug_enabled
    )

    if debug_enabled and steps is not None and db_alias_step:
        db_alias_step["duration_ms"] = round((time.time() - t0) * 1000, 2)
        db_alias_step["hit"] = db_match is not None
        steps.append(db_alias_step)

    if db_match:
        await _write_match_cache(title, artist, db_match, "db_alias")
        await _write_match_log(title, artist, db_match, "db_alias", steps)
        return db_match, steps

    # ── Step 5: database fuzzy search (pg_trgm) ───────────────────────────
    t0 = time.time()
    db_fuzzy, db_fuzzy_step = await _find_db_fuzzy_match(
        title, artist, threshold, debug=debug_enabled
    )

    if debug_enabled and steps is not None and db_fuzzy_step:
        db_fuzzy_step["duration_ms"] = round((time.time() - t0) * 1000, 2)
        db_fuzzy_step["hit"] = db_fuzzy is not None
        steps.append(db_fuzzy_step)

    if db_fuzzy:
        await _write_match_cache(title, artist, db_fuzzy, "db_fuzzy")
        await _write_match_log(title, artist, db_fuzzy, "db_fuzzy", steps)
        return db_fuzzy, steps

    # ── Step 6: Subsonic fallback (gated by match_mode or force_mode) ───────
    if force_mode:
        effective_mode = force_mode
    else:
        effective_mode = await _get_match_mode()

    if effective_mode == "local":
        await _write_match_log(title, artist, None, "miss", steps)
        await _record_miss(title, artist, threshold, source="local")
        return None, steps

    if effective_mode == "api":
        # Skip local steps 1-5, go straight to Subsonic
        t0 = time.time()
        nav_results = await navidrome_multi_search(title, artist)
        best = pick_best_match(title, artist, nav_results, threshold)
        if debug_enabled and steps is not None:
            subsonic_candidates = []
            for r in nav_results:
                scores = score_candidate(title, artist, r.get("title") or "", r.get("artist") or "")
                subsonic_candidates.append({
                    "id": r.get("id"), "title": r.get("title"), "artist": r.get("artist"),
                    "album": r.get("album"), "duration": r.get("duration"),
                    "score": scores["score"], "title_score": scores["title_score"],
                    "title_core_score": scores["title_core_score"], "artist_score": scores["artist_score"],
                    "query_label": r.get("_query_label"),
                })
            subsonic_candidates.sort(key=lambda x: x["score"], reverse=True)
            steps.append(_step_info(
                step="subsonic", hit=best is not None,
                candidates_count=len(nav_results),
                best_score=best.get("score") if best else (subsonic_candidates[0]["score"] if subsonic_candidates else None),
                best_candidate=best or (subsonic_candidates[0] if subsonic_candidates else None),
                top_candidates=subsonic_candidates[:5],
                duration_ms=round((time.time() - t0) * 1000, 2), threshold=threshold,
            ))
        if best and best.get("id"):
            from app.services.song_library_service import upsert_song_to_library
            async with AsyncSessionLocal() as db:
                await upsert_song_to_library(db, {
                    "id": best.get("id"), "title": best.get("title"),
                    "artist": best.get("artist"), "album": best.get("album"),
                    "duration": best.get("duration"),
                }, source="passive")
                await db.commit()
            await song_cache.add_song({
                "id": best.get("id"), "title": best.get("title"),
                "artist": best.get("artist"), "album": best.get("album"),
                "duration": best.get("duration"),
            }, source="passive")
            best["source"] = "subsonic"
            await _write_match_cache(title, artist, best, "subsonic")
            await _write_match_log(title, artist, best, "subsonic", steps)
            return best, steps
        await _write_match_log(title, artist, None, "miss", steps)
        await _record_miss(title, artist, threshold, source="api")
        return None, steps

    # effective_mode == "full" (default) – run full local chain first
    t0 = time.time()
    nav_results = await navidrome_multi_search(title, artist)
    best = pick_best_match(title, artist, nav_results, threshold)

    if debug_enabled and steps is not None:
        subsonic_candidates = []
        for r in nav_results:
            scores = score_candidate(
                title, artist,
                r.get("title") or "", r.get("artist") or "",
            )
            subsonic_candidates.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "artist": r.get("artist"),
                    "album": r.get("album"),
                    "duration": r.get("duration"),
                    "score": scores["score"],
                    "title_score": scores["title_score"],
                    "title_core_score": scores["title_core_score"],
                    "artist_score": scores["artist_score"],
                    "query_label": r.get("_query_label"),
                }
            )
        subsonic_candidates.sort(key=lambda x: x["score"], reverse=True)

        steps.append(
            _step_info(
                step="subsonic",
                hit=best is not None,
                candidates_count=len(nav_results),
                best_score=(
                    best.get("score")
                    if best
                    else subsonic_candidates[0]["score"]
                    if subsonic_candidates
                    else None
                ),
                best_candidate=best or (
                    subsonic_candidates[0] if subsonic_candidates else None
                ),
                top_candidates=subsonic_candidates[:5],
                duration_ms=round((time.time() - t0) * 1000, 2),
                threshold=threshold,
            )
        )

    if best and best.get("id"):
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
        await _write_match_log(title, artist, best, "subsonic", steps)
        return best, steps

    await _write_match_log(title, artist, None, "miss", steps)
    await _record_miss(title, artist, threshold, source="full")
    return None, steps


# ── Local-only entry point for missed-track retry ─────────────────────────────

async def match_track_local_only(
    title: str,
    artist: str,
    threshold: float = 0.75,
) -> dict | None:
    """
    Force local-only matching for scheduled retry of missed tracks.
    Does NOT record misses again (avoid re-triggering the task pool).
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
    db_match, _ = await _find_db_alias_match(title, artist, threshold)
    if db_match:
        await _write_match_cache(title, artist, db_match, "db_alias")
        await _write_match_log(title, artist, db_match, "db_alias")
        return db_match

    # 5. database fuzzy search (pg_trgm)
    db_fuzzy, _ = await _find_db_fuzzy_match(title, artist, threshold)
    if db_fuzzy:
        await _write_match_cache(title, artist, db_fuzzy, "db_fuzzy")
        await _write_match_log(title, artist, db_fuzzy, "db_fuzzy")
        return db_fuzzy

    # No match in local index; retry context does not call Subsonic
    await _write_match_log(title, artist, None, "miss")
    return None


# ── Public entry points ────────────────────────────────────────────────────────

async def match_track(
    title: str,
    artist: str,
    threshold: float = 0.75,
    force_mode: str | None = None,
) -> dict | None:
    """
    Unified matching chain (original signature, backward-compatible).
    Returns a dict with id/title/artist/album/duration/score/source or None.

    Args:
        force_mode: override match_mode lookup.
            "local"  -> local only (skip Subsonic)
            "api"    -> Subsonic only (skip local steps)
            "full"   -> local + Subsonic (same as full chain)
            None    -> respect match_mode setting
    """
    match, _ = await _match_track_internal(
        title=title,
        artist=artist,
        threshold=threshold,
        force_debug=False,
        force_mode=force_mode,
    )
    return match


async def match_track_debug(
    title: str,
    artist: str,
    threshold: float = 0.75,
) -> dict:
    """
    Force-debug version of match_track.
    Always collects and returns full chain steps regardless of system settings.
    Returns {"result": match, "steps": [...]}.
    """
    match, steps = await _match_track_internal(
        title=title,
        artist=artist,
        threshold=threshold,
        force_debug=True,
        force_mode=None,
    )
    return {
        "result": match,
        "steps": steps or [],
    }


# ── Config-aware entry points ──────────────────────────────────────────────────

async def match_track_with_config(
    title: str,
    artist: str,
    config: MatchConfig,
) -> dict | None:
    """
    Unified matching chain driven by MatchConfig.

    Args:
        config: MatchConfig instance (threshold, force_mode, write_cache, record_miss).
    """
    match, _ = await _match_track_internal(
        title=title,
        artist=artist,
        threshold=config.threshold,
        force_debug=False,
        force_mode=config.force_mode,
    )
    return match


async def match_tracks_batch(
    tracks: list[dict],
    config: MatchConfig,
) -> list[dict]:
    """
    Match a batch of tracks using MatchConfig.

    Args:
        tracks:       List of {"title": ..., "artist": ...}
        config:       MatchConfig instance.

    Returns:
        List of {"index": int, "title": str, "artist": str, "best_match": dict | None}.
    """
    import asyncio

    concurrency = max(1, min(20, config.concurrency))
    semaphore = asyncio.Semaphore(concurrency)

    async def _search_one(idx: int, title: str, artist: str):
        async with semaphore:
            try:
                best = await match_track_with_config(
                    title=title,
                    artist=artist,
                    config=config,
                )
                return {"index": idx, "title": title, "artist": artist, "best_match": best}
            except Exception as e:
                logger.error("[batch] failed index=%s title=%s artist=%s: %s", idx, title, artist, e)
                return {"index": idx, "title": title, "artist": artist, "best_match": None, "error": str(e)}

    tasks = []
    for i, t in enumerate(tracks):
        title = t.get("title", "")
        artist = t.get("artist", "")
        if not title:
            continue
        tasks.append(_search_one(i, title, artist))

    results: list[dict | None] = [None] * len(tracks)
    for coro in asyncio.as_completed(tasks):
        result = await coro
        results[result["index"]] = result

    # Fill gaps
    for i, r in enumerate(results):
        if r is None:
            results[i] = {"index": i, "title": tracks[i].get("title", ""), "artist": tracks[i].get("artist", ""), "best_match": None}

    return results