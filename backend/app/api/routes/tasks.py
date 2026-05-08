"""Task center routes."""

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.services.playlist_cleanup_service import (
    preview_playlist_cleanup,
    run_playlist_cleanup,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


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