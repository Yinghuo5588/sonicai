"""Job run creation service.

Centralized creation of RecommendationRun rows with database-level concurrency
protection.

Why this exists:
- FastAPI auth dependency may already have started a transaction on the request
  AsyncSession.
- Starting another `async with db.begin()` on that same session raises:
  "A transaction is already begun on this Session."
- This service uses its own fresh AsyncSession and PostgreSQL advisory locks,
  making job creation safe across requests, workers and containers.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import RecommendationRun

logger = logging.getLogger(__name__)


ACTIVE_STATUSES = ("pending", "running")


def _advisory_lock_id(name: str) -> int:
    """
    Convert a lock name into a stable signed 63-bit integer for PostgreSQL
    pg_advisory_xact_lock(bigint).

    Do not use Python's built-in hash(), because it is randomized per process.
    """
    digest = hashlib.sha256(name.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=False) & 0x7FFFFFFFFFFFFFFF


async def _acquire_advisory_locks(db: AsyncSession, lock_names: Iterable[str]) -> None:
    """
    Acquire transaction-scoped advisory locks in deterministic order.

    Deterministic ordering prevents deadlocks when one operation needs multiple
    locks, for example:
      - full recommendation locks full + similar_tracks + similar_artists
      - similar_tracks locks full + similar_tracks
    """
    unique_names = sorted(set(lock_names))

    for name in unique_names:
        lock_id = _advisory_lock_id(name)
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": lock_id},
        )


async def create_pending_run(
    *,
    run_type: str,
    current_user_id: int | None,
    trigger_type: str = "manual",
    conflict_types: list[str] | None = None,
    lock_scope: str = "recommendation",
    stale_after_minutes: int | None = None,
) -> int:
    """
    Create a pending RecommendationRun safely.

    Args:
        run_type:
            Actual run_type to insert.
        current_user_id:
            User id that created this run. Use None for scheduled jobs.
        trigger_type:
            manual | scheduled
        conflict_types:
            Existing run types considered conflicting. If omitted, defaults to
            [run_type].
        lock_scope:
            Namespace used for advisory locks. Keep different business domains
            independent, e.g. recommendation, hotboard, playlist.
        stale_after_minutes:
            Optional. If provided, running jobs older than this will be marked
            failed before conflict check.

    Returns:
        Newly created RecommendationRun.id.

    Raises:
        HTTPException(409) if a conflicting pending/running job already exists.
    """
    if conflict_types is None:
        conflict_types = [run_type]

    lock_names = [f"{lock_scope}:{t}" for t in conflict_types]

    async with AsyncSessionLocal() as db:
        async with db.begin():
            await _acquire_advisory_locks(db, lock_names)

            if stale_after_minutes is not None and stale_after_minutes > 0:
                stale_cutoff = datetime.now(timezone.utc) - timedelta(
                    minutes=stale_after_minutes
                )
                stale_result = await db.execute(
                    select(RecommendationRun).where(
                        RecommendationRun.status == "running",
                        RecommendationRun.run_type.in_(conflict_types),
                        RecommendationRun.started_at < stale_cutoff,
                    )
                )
                stale_rows = stale_result.scalars().all()

                for row in stale_rows:
                    row.status = "failed"
                    row.error_message = "Stale job cleaned - auto-marked failed"
                    row.finished_at = datetime.now(timezone.utc)

                if stale_rows:
                    logger.warning(
                        "Marked %s stale runs as failed, conflict_types=%s",
                        len(stale_rows),
                        conflict_types,
                    )

            result = await db.execute(
                select(RecommendationRun.id)
                .where(
                    RecommendationRun.status.in_(ACTIVE_STATUSES),
                    RecommendationRun.run_type.in_(conflict_types),
                )
                .with_for_update()
                .limit(1)
            )

            if result.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A job of type(s) "
                        f"{', '.join(conflict_types)} "
                        "is already pending or running"
                    ),
                )

            run = RecommendationRun(
                run_type=run_type,
                trigger_type=trigger_type,
                status="pending",
                started_at=None,
                finished_at=None,
                created_by_user_id=current_user_id,
            )
            db.add(run)
            await db.flush()

            return int(run.id)
