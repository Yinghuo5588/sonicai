"""Navidrome favorite tracks sync service."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from sqlalchemy import select, delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, NavidromeFavoriteTrack
from app.services.navidrome_service import navidrome_get_starred_songs
from app.utils.text_normalizer import normalize_for_compare, normalize_artist, dedup_key

logger = logging.getLogger(__name__)


def _parse_starred_at(value) -> datetime | None:
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    text = str(value).strip()
    if not text:
        return None

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        pass

    try:
        return parsedate_to_datetime(text)
    except Exception:
        return None


def _parse_duration(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except Exception:
        return None


async def sync_navidrome_favorites_to_db() -> dict:
    """Full sync Navidrome starred songs into local navidrome_favorite_tracks table."""
    now = datetime.now(timezone.utc)
    songs = await navidrome_get_starred_songs()

    async with AsyncSessionLocal() as db:
        settings_result = await db.execute(select(SystemSettings))
        settings = settings_result.scalar_one_or_none()
        if not settings:
            settings = SystemSettings()
            db.add(settings)
            await db.flush()

        try:
            seen_ids: set[str] = set()
            upserted = 0

            for raw in songs:
                navidrome_id = str(raw.get("id") or "").strip()
                title = str(raw.get("title") or "").strip()
                artist = str(raw.get("artist") or "").strip()
                album = str(raw.get("album") or "").strip()

                if not navidrome_id or not title:
                    continue

                seen_ids.add(navidrome_id)

                stmt = pg_insert(NavidromeFavoriteTrack).values(
                    navidrome_id=navidrome_id,
                    title=title,
                    artist=artist,
                    album=album,
                    duration=_parse_duration(raw.get("duration")),
                    title_norm=normalize_for_compare(title),
                    artist_norm=normalize_artist(artist),
                    dedup_key=dedup_key(title, artist),
                    starred_at=_parse_starred_at(raw.get("starred")),
                    last_seen_at=now,
                    updated_at=now,
                )

                stmt = stmt.on_conflict_do_update(
                    index_elements=["navidrome_id"],
                    set_={
                        "title": stmt.excluded.title,
                        "artist": stmt.excluded.artist,
                        "album": stmt.excluded.album,
                        "duration": stmt.excluded.duration,
                        "title_norm": stmt.excluded.title_norm,
                        "artist_norm": stmt.excluded.artist_norm,
                        "dedup_key": stmt.excluded.dedup_key,
                        "starred_at": stmt.excluded.starred_at,
                        "last_seen_at": stmt.excluded.last_seen_at,
                        "updated_at": stmt.excluded.updated_at,
                    },
                )

                await db.execute(stmt)
                upserted += 1

            if seen_ids:
                await db.execute(
                    delete(NavidromeFavoriteTrack).where(
                        NavidromeFavoriteTrack.navidrome_id.notin_(seen_ids)
                    )
                )
            else:
                await db.execute(delete(NavidromeFavoriteTrack))

            settings.favorite_tracks_last_sync_at = now
            settings.favorite_tracks_last_error = None

            await db.commit()

            return {
                "total": len(songs),
                "upserted": upserted,
                "last_sync_at": now.isoformat(),
            }

        except Exception as e:
            logger.exception("[favorites] sync failed")
            settings.favorite_tracks_last_error = str(e)[:2000]
            await db.commit()
            raise


async def favorite_tracks_status() -> dict:
    async with AsyncSessionLocal() as db:
        total_result = await db.execute(select(func.count(NavidromeFavoriteTrack.id)))
        total = int(total_result.scalar() or 0)

        settings_result = await db.execute(select(SystemSettings))
        settings = settings_result.scalar_one_or_none()

        return {
            "total": total,
            "sync_enabled": bool(getattr(settings, "favorite_tracks_sync_enabled", True)) if settings else True,
            "sync_cron": getattr(settings, "favorite_tracks_sync_cron", "15 4 * * *") if settings else "15 4 * * *",
            "last_sync_at": (
                settings.favorite_tracks_last_sync_at.isoformat()
                if settings and settings.favorite_tracks_last_sync_at
                else None
            ),
            "last_error": getattr(settings, "favorite_tracks_last_error", None) if settings else None,
            "ai_sample_limit": int(getattr(settings, "ai_favorites_sample_limit", 40) or 40) if settings else 40,
        }


async def get_favorite_sample(limit: int = 40) -> list[dict]:
    limit = max(1, min(200, int(limit or 40)))

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(NavidromeFavoriteTrack)
            .order_by(
                NavidromeFavoriteTrack.starred_at.desc().nullslast(),
                NavidromeFavoriteTrack.id.desc(),
            )
            .limit(limit)
        )
        rows = result.scalars().all()

        return [
            {
                "id": row.navidrome_id,
                "title": row.title,
                "artist": row.artist or "",
                "album": row.album or "",
                "duration": row.duration,
                "starred_at": row.starred_at.isoformat() if row.starred_at else None,
            }
            for row in rows
        ]


async def get_all_favorite_dedup_keys() -> set[str]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(NavidromeFavoriteTrack.dedup_key)
            .where(NavidromeFavoriteTrack.dedup_key.isnot(None))
        )
        return {row[0] for row in result.all() if row[0]}


async def list_favorite_tracks(
    *,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    limit = max(1, min(200, int(limit or 50)))
    offset = max(0, int(offset or 0))

    async with AsyncSessionLocal() as db:
        query = select(NavidromeFavoriteTrack).order_by(
            NavidromeFavoriteTrack.starred_at.desc().nullslast(),
            NavidromeFavoriteTrack.id.desc(),
        )

        if q:
            keyword = f"%{q}%"
            query = query.where(
                NavidromeFavoriteTrack.title.ilike(keyword)
                | NavidromeFavoriteTrack.artist.ilike(keyword)
                | NavidromeFavoriteTrack.album.ilike(keyword)
            )

        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = int(count_result.scalar() or 0)

        result = await db.execute(query.limit(limit).offset(offset))
        rows = result.scalars().all()

        return {
            "total": total,
            "items": [
                {
                    "id": row.id,
                    "navidrome_id": row.navidrome_id,
                    "title": row.title,
                    "artist": row.artist,
                    "album": row.album,
                    "duration": row.duration,
                    "starred_at": row.starred_at.isoformat() if row.starred_at else None,
                    "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
                }
                for row in rows
            ],
        }