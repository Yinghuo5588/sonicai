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
from app.db.models import SystemSettings, GeneratedPlaylist, RecommendationRun, PlaylistRetentionPolicy
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
    keep_days: int
    delete_navidrome: bool


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


async def _load_settings() -> SystemSettings | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        return result.scalar_one_or_none()


DEFAULT_RETENTION_POLICIES = {
    "similar_tracks": {
        "enabled": True,
        "keep_days": 7,
        "delete_navidrome": True,
        "keep_recent_success_count": 2,
    },
    "similar_artists": {
        "enabled": True,
        "keep_days": 7,
        "delete_navidrome": True,
        "keep_recent_success_count": 2,
    },
    "hotboard": {
        "enabled": True,
        "keep_days": 3,
        "delete_navidrome": True,
        "keep_recent_success_count": 2,
    },
    "playlist_netease": {
        "enabled": False,
        "keep_days": 30,
        "delete_navidrome": False,
        "keep_recent_success_count": 1,
    },
    "playlist_text": {
        "enabled": False,
        "keep_days": 30,
        "delete_navidrome": False,
        "keep_recent_success_count": 1,
    },
    "playlist_incremental": {
        "enabled": False,
        "keep_days": 0,
        "delete_navidrome": False,
        "keep_recent_success_count": 1,
    },
    "ai_recommendation": {
        "enabled": False,
        "keep_days": 30,
        "delete_navidrome": False,
        "keep_recent_success_count": 1,
    },
}


async def ensure_default_retention_policies() -> list[PlaylistRetentionPolicy]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PlaylistRetentionPolicy))
        existing_rows = result.scalars().all()
        existing = {row.playlist_type: row for row in existing_rows}

        changed = False

        for playlist_type, cfg in DEFAULT_RETENTION_POLICIES.items():
            if playlist_type in existing:
                continue

            db.add(
                PlaylistRetentionPolicy(
                    playlist_type=playlist_type,
                    enabled=cfg["enabled"],
                    keep_days=cfg["keep_days"],
                    delete_navidrome=cfg["delete_navidrome"],
                    keep_recent_success_count=cfg["keep_recent_success_count"],
                )
            )
            changed = True

        if changed:
            await db.commit()

        result = await db.execute(
            select(PlaylistRetentionPolicy).order_by(PlaylistRetentionPolicy.id)
        )
        return result.scalars().all()


async def list_retention_policies() -> list[dict]:
    rows = await ensure_default_retention_policies()

    return [
        {
            "id": row.id,
            "playlist_type": row.playlist_type,
            "enabled": bool(row.enabled),
            "keep_days": int(row.keep_days or 0),
            "delete_navidrome": bool(row.delete_navidrome),
            "keep_recent_success_count": int(row.keep_recent_success_count or 0),
            "created_at": _iso(row.created_at),
            "updated_at": _iso(row.updated_at),
        }
        for row in rows
    ]


async def update_retention_policy(
    playlist_type: str,
    *,
    enabled: bool,
    keep_days: int,
    delete_navidrome: bool,
    keep_recent_success_count: int,
) -> dict:
    await ensure_default_retention_policies()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PlaylistRetentionPolicy).where(
                PlaylistRetentionPolicy.playlist_type == playlist_type
            )
        )
        row = result.scalar_one_or_none()

        if not row:
            row = PlaylistRetentionPolicy(playlist_type=playlist_type)
            db.add(row)
            await db.flush()

        row.enabled = bool(enabled)
        row.keep_days = max(0, int(keep_days or 0))
        row.delete_navidrome = bool(delete_navidrome)
        row.keep_recent_success_count = max(0, int(keep_recent_success_count or 0))
        row.updated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(row)

        return {
            "id": row.id,
            "playlist_type": row.playlist_type,
            "enabled": bool(row.enabled),
            "keep_days": int(row.keep_days or 0),
            "delete_navidrome": bool(row.delete_navidrome),
            "keep_recent_success_count": int(row.keep_recent_success_count or 0),
            "created_at": _iso(row.created_at),
            "updated_at": _iso(row.updated_at),
        }


async def _find_cleanup_candidates(
    *,
    force: bool = False,
) -> tuple[list[CleanupCandidate], dict]:
    settings = await _load_settings()
    if not settings:
        return [], {
            "skip_disabled_count": 0,
            "skip_failed_count": 0,
            "skip_recent_keep_count": 0,
        }

    if not force and not bool(getattr(settings, "playlist_cleanup_enabled", False)):
        return [], {
            "skip_disabled_count": 0,
            "skip_failed_count": 0,
            "skip_recent_keep_count": 0,
        }

    policies = await ensure_default_retention_policies()
    policy_map = {p.playlist_type: p for p in policies}

    # 兼容旧配置：没有策略时回退全局设置
    global_keep_days = int(settings.playlist_keep_days or 0)
    global_delete_navidrome = bool(
        getattr(settings, "playlist_cleanup_delete_navidrome", False)
    )
    global_keep_recent_success_count = int(
        getattr(settings, "playlist_cleanup_keep_recent_success_count", 2) or 0
    )

    keep_failed = bool(getattr(settings, "playlist_cleanup_keep_failed", True))

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(GeneratedPlaylist)
            .join(RecommendationRun, RecommendationRun.id == GeneratedPlaylist.run_id)
            .where(GeneratedPlaylist.navidrome_playlist_id.isnot(None))
            .where(RecommendationRun.status.notin_(["pending", "running"]))
            .options(selectinload(GeneratedPlaylist.run))
            .order_by(GeneratedPlaylist.playlist_type, GeneratedPlaylist.created_at.desc())
        )
        playlists = result.scalars().all()

        grouped: dict[str, list[GeneratedPlaylist]] = defaultdict(list)
        skip_disabled_count = 0
        skip_failed_count = 0
        skip_recent_keep_count = 0

        now = datetime.now(timezone.utc)

        for pl in playlists:
            policy = policy_map.get(pl.playlist_type)

            if policy:
                enabled = bool(policy.enabled)
                keep_days = int(policy.keep_days or 0)
            else:
                enabled = global_keep_days > 0
                keep_days = global_keep_days

            if not enabled or keep_days <= 0:
                skip_disabled_count += 1
                continue

            if keep_failed and getattr(pl.run, "status", None) in {
                "failed",
                "stopped",
                "partial_success",
            }:
                skip_failed_count += 1
                continue

            if not pl.created_at:
                continue

            cutoff = now - timedelta(days=keep_days)
            # Ensure consistent timezone comparison
            pl_created = pl.created_at
            if pl_created.tzinfo is None:
                pl_created = pl_created.replace(tzinfo=timezone.utc)
            if pl_created >= cutoff:
                continue

            grouped[pl.playlist_type].append(pl)

        candidates: list[CleanupCandidate] = []

        for playlist_type, rows in grouped.items():
            policy = policy_map.get(playlist_type)

            if policy:
                keep_days = int(policy.keep_days or 0)
                delete_navidrome = bool(policy.delete_navidrome)
                keep_recent_success_count = int(policy.keep_recent_success_count or 0)
            else:
                keep_days = global_keep_days
                delete_navidrome = global_delete_navidrome
                keep_recent_success_count = global_keep_recent_success_count

            rows_sorted = sorted(
                rows,
                key=lambda x: x.created_at or datetime.min,
                reverse=True,
            )

            if keep_recent_success_count > 0:
                kept = rows_sorted[:keep_recent_success_count]
                deletable_rows = rows_sorted[keep_recent_success_count:]
                skip_recent_keep_count += len(kept)
            else:
                deletable_rows = rows_sorted

            for pl in deletable_rows:
                candidates.append(
                    CleanupCandidate(
                        playlist_id=pl.id,
                        run_id=pl.run_id,
                        playlist_name=pl.playlist_name,
                        playlist_type=pl.playlist_type,
                        created_at=pl.created_at,
                        navidrome_playlist_id=str(pl.navidrome_playlist_id),
                        reason=f"超过 {playlist_type} 类型保留天数 {keep_days} 天",
                        keep_days=keep_days,
                        delete_navidrome=delete_navidrome,
                    )
                )

        return candidates, {
            "skip_disabled_count": skip_disabled_count,
            "skip_failed_count": skip_failed_count,
            "skip_recent_keep_count": skip_recent_keep_count,
        }


async def preview_playlist_cleanup(*, force: bool = True) -> dict:
    """Preview expired playlists. No deletion."""
    candidates, skip_stats = await _find_cleanup_candidates(force=force)

    by_type: dict[str, int] = defaultdict(int)
    delete_navidrome_count = 0
    clear_local_only_count = 0

    for item in candidates:
        by_type[item.playlist_type] += 1
        if item.delete_navidrome:
            delete_navidrome_count += 1
        else:
            clear_local_only_count += 1

    return {
        "total": len(candidates),
        "by_type": dict(by_type),
        "operation_stats": {
            "delete_navidrome_count": delete_navidrome_count,
            "clear_local_only_count": clear_local_only_count,
            "skip_disabled_count": skip_stats["skip_disabled_count"],
            "skip_failed_count": skip_stats["skip_failed_count"],
            "skip_recent_keep_count": skip_stats["skip_recent_keep_count"],
        },
        "items": [
            {
                "playlist_id": item.playlist_id,
                "run_id": item.run_id,
                "playlist_name": item.playlist_name,
                "playlist_type": item.playlist_type,
                "created_at": _iso(item.created_at),
                "navidrome_playlist_id": item.navidrome_playlist_id,
                "reason": item.reason,
                "keep_days": item.keep_days,
                "delete_navidrome": item.delete_navidrome,
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

    candidates, _skip_stats = await _find_cleanup_candidates(force=force)

    deleted_navidrome_count = 0
    failed_navidrome_count = 0
    updated_local_count = 0
    failed_items: list[dict] = []

    async with AsyncSessionLocal() as db:
        for item in candidates:
            row = await db.get(GeneratedPlaylist, item.playlist_id)
            if not row or not row.navidrome_playlist_id:
                continue

            if item.delete_navidrome:
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
