"""missed_track_service - record and manage unmatched tracks."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, func

from app.db.session import AsyncSessionLocal
from app.db.models import MissedTrack
from app.utils.text_normalizer import normalize_for_compare, normalize_artist


async def record_missed_track(
    *,
    title: str,
    artist: str | None,
    threshold: float = 0.75,
    source: str | None = None,
) -> None:
    """Upsert a missed track into the task pool.

    - Same normalized (title_norm, artist_norm) updates existing row.
    - seen_count increments each time the same track is seen again.
    - If status == 'ignored', it stays ignored (user explicitly marked it).
    - If status == 'failed', it resets to 'pending' so future retries can try again.
    """
    title = (title or "").strip()
    artist = (artist or "").strip()

    if not title:
        return

    title_norm = normalize_for_compare(title)
    artist_norm = normalize_artist(artist) or ""
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MissedTrack).where(
                MissedTrack.title_norm == title_norm,
                MissedTrack.artist_norm == artist_norm,
            )
        )
        row = result.scalar_one_or_none()

        if row:
            row.title = title
            row.artist = artist
            row.match_threshold = threshold
            row.source = source or row.source
            row.seen_count = (row.seen_count or 0) + 1
            row.last_seen_at = now
            row.updated_at = now
            row.last_error = None

            # ignored rows should stay ignored; failed rows can be retried
            if row.status != "ignored":
                row.status = "pending"

            await db.commit()
            return

        db.add(
            MissedTrack(
                title=title,
                artist=artist,
                title_norm=title_norm,
                artist_norm=artist_norm,
                match_threshold=threshold,
                status="pending",
                source=source,
                seen_count=1,
                retry_count=0,
                max_retries=5,
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            )
        )
        await db.commit()


async def get_missed_track_stats() -> dict:
    """Return counts per status."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MissedTrack.status, func.count(MissedTrack.id))
            .group_by(MissedTrack.status)
        )
        rows = result.all()

        stats = {
            "pending": 0,
            "matched": 0,
            "failed": 0,
            "ignored": 0,
        }

        for status, count in rows:
            stats[status or "pending"] = int(count or 0)

        stats["total"] = sum(stats.values())
        return stats