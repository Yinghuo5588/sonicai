"""Task center routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser
from app.services.playlist_cleanup_service import (
    preview_playlist_cleanup,
    run_playlist_cleanup,
    list_retention_policies,
    update_retention_policy,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


class PlaylistRetentionPolicyUpdateRequest(BaseModel):
    enabled: bool
    keep_days: int = Field(ge=0, le=3650)
    delete_navidrome: bool
    keep_recent_success_count: int = Field(ge=0, le=20)


@router.post("/playlist-cleanup/preview")
async def preview_cleanup(current_user: CurrentUser):
    """Preview playlists that would be cleaned."""
    return await preview_playlist_cleanup(force=True)


@router.post("/playlist-cleanup/run")
async def run_cleanup(current_user: CurrentUser):
    """Run playlist cleanup manually."""
    return await run_playlist_cleanup(force=True)


@router.get("/status")
async def get_task_status(current_user: CurrentUser):
    """Return active background tasks."""
    from app.core.task_registry import get_active_tasks

    return {
        "active_tasks": get_active_tasks(),
    }


@router.get("/playlist-retention-policies")
async def get_playlist_retention_policies(current_user: CurrentUser):
    """Return playlist retention policies."""
    return {
        "items": await list_retention_policies(),
    }


@router.put("/playlist-retention-policies/{playlist_type}")
async def put_playlist_retention_policy(
    playlist_type: str,
    body: PlaylistRetentionPolicyUpdateRequest,
    current_user: CurrentUser,
):
    """Update one playlist retention policy."""
    if not playlist_type.strip():
        raise HTTPException(status_code=400, detail="playlist_type is required")

    return await update_retention_policy(
        playlist_type=playlist_type.strip(),
        enabled=body.enabled,
        keep_days=body.keep_days,
        delete_navidrome=body.delete_navidrome,
        keep_recent_success_count=body.keep_recent_success_count,
    )
