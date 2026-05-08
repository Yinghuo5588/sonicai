"""Playlist lifecycle cleanup service.

This service cleans SonicAI-created Navidrome playlists based on
GeneratedPlaylist records and retention settings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, GeneratedPlaylist, RecommendationRun
from app.services.navidrome_service import navidrome_delete_playlist

logger = logging.getLogger(__name__)


@dataclass
class CleanupCandidate:
    playlist_id: int
    run_id: int
    playlist_name: str
    playlist_type: str
    created_at: datetime | None
    navidrome_playlist_id: str
    reason: str


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


async def _load_settings() -> SystemSettings | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        return result.scalar_one_or_none()


async def _find_cleanup_candidates(
    *,
    force: bool = False,
) -> list[CleanupCandidate]:
    settings = await _load_settings()
    if not settings:
        return []

    keep_days = int(settings.playlist_keep_days or 0)
    if keep_days <= 0:
        return []

    if not force and not bool(getattr(settings, "playlist_cleanup_enabled", False)):
        return []

    keep_recent_success_count = int(
        getattr(settings, "playlist_cleanup_keep_recent_success_count", 2) or 0
    )
    keep_failed = bool(getattr(settings, "playlist_cleanup_keep_failed", True))

    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(GeneratedPlaylist)
            .join(RecommendationRun, RecommendationRun.id == GeneratedPlaylist.run_id)
            .where(GeneratedPlaylist.created_at < cutoff)
            .where(GeneratedPlaylist.navidrome_playlist_id.isnot(None))
            .where(RecommendationRun.status.notin_(["pending", "running"]))
            .options(selectinload(GeneratedPlaylist.run))
            .order_by(GeneratedPlaylist.playlist_type, GeneratedPlaylist.created_at.desc())
        )
        playlists = result.scalars().all()

        if not playlists:
            return []

        # 保留失败任务的歌单
        if keep_failed:
            playlists = [
                pl for pl in playlists
                if not getattr(pl.run, "status", None) in {"failed", "stopped", "partial_success"}
            ]

        # 按类型保留最近 N 个成功歌单
        grouped: dict[str, list[GeneratedPlaylist]] = defaultdict(list)
        for pl in playlists:
            grouped[pl.playlist_type].append(pl)

        candidates: list[CleanupCandidate] = []

        for playlist_type, rows in grouped.items():
            rows_sorted = sorted(
                rows,
                key=lambda x: x.created_at or datetime.min,
                reverse=True,
            )

            deletable_rows = rows_sorted[keep_recent_success_count:] if keep_recent_success_count > 0 else rows_sorted

            for pl in deletable_rows:
                candidates.append(
                    CleanupCandidate(
                        playlist_id=pl.id,
                        run_id=pl.run_id,
                        playlist_name=pl.playlist_name,
                        playlist_type=pl.playlist_type,
                        created_at=pl.created_at,
                        navidrome_playlist_id=str(pl.navidrome_playlist_id),
                        reason=f"超过默认保留天数 {keep_days} 天",
                    )
                )

        return candidates


async def preview_playlist_cleanup(*, force: bool = True) -> dict:
    """Preview expired playlists. No deletion."""
    candidates = await _find_cleanup_candidates(force=force)

    by_type: dict[str, int] = defaultdict(int)
    for item in candidates:
        by_type[item.playlist_type] += 1

    return {
        "total": len(candidates),
        "by_type": dict(by_type),
        "items": [
            {
                "playlist_id": item.playlist_id,
                "run_id": item.run_id,
                "playlist_name": item.playlist_name,
                "playlist_type": item.playlist_type,
                "created_at": _iso(item.created_at),
                "navidrome_playlist_id": item.navidrome_playlist_id,
                "reason": item.reason,
            }
            for item in candidates
        ],
    }


async def run_playlist_cleanup(*, force: bool = False) -> dict:
    """Run cleanup. By default respects playlist_cleanup_enabled."""
    settings = await _load_settings()
    if not settings:
        return {
            "scanned": 0,
            "deleted_navidrome_count": 0,
            "failed_navidrome_count": 0,
            "updated_local_count": 0,
            "failed_items": [],
            "message": "SystemSettings not found",
        }

    if not force and not bool(getattr(settings, "playlist_cleanup_enabled", False)):
        return {
            "scanned": 0,
            "deleted_navidrome_count": 0,
            "failed_navidrome_count": 0,
            "updated_local_count": 0,
            "failed_items": [],
            "message": "Playlist cleanup disabled",
        }

    candidates = await _find_cleanup_candidates(force=force)

    delete_navidrome = bool(
        getattr(settings, "playlist_cleanup_delete_navidrome", False)
    )

    deleted_navidrome_count = 0
    failed_navidrome_count = 0
    updated_local_count = 0
    failed_items: list[dict] = []

    async with AsyncSessionLocal() as db:
        for item in candidates:
            row = await db.get(GeneratedPlaylist, item.playlist_id)
            if not row or not row.navidrome_playlist_id:
                continue

            if delete_navidrome:
                try:
                    ok = await navidrome_delete_playlist(str(row.navidrome_playlist_id))
                    if ok:
                        deleted_navidrome_count += 1
                    else:
                        failed_navidrome_count += 1
                        failed_items.append({
                            "playlist_id": item.playlist_id,
                            "playlist_name": item.playlist_name,
                            "navidrome_playlist_id": item.navidrome_playlist_id,
                            "error": "Navidrome delete returned false",
                        })
                        continue
                except Exception as e:
                    failed_navidrome_count += 1
                    failed_items.append({
                        "playlist_id": item.playlist_id,
                        "playlist_name": item.playlist_name,
                        "navidrome_playlist_id": item.navidrome_playlist_id,
                        "error": str(e),
                    })
                    continue

            # 第一版不删除 GeneratedPlaylist 记录，只清空远端 ID
            row.navidrome_playlist_id = None
            updated_local_count += 1

        await db.commit()

    logger.info(
        "[playlist-cleanup] scanned=%s deleted_navidrome=%s failed_navidrome=%s updated_local=%s",
        len(candidates),
        deleted_navidrome_count,
        failed_navidrome_count,
        updated_local_count,
    )

    return {
        "scanned": len(candidates),
        "deleted_navidrome_count": deleted_navidrome_count,
        "failed_navidrome_count": failed_navidrome_count,
        "updated_local_count": updated_local_count,
        "failed_items": failed_items,
    }