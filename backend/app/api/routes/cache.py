"""Song cache routes."""

from fastapi import APIRouter
from app.api.deps import CurrentUser
from app.services.song_cache import song_cache

router = APIRouter(prefix="/cache", tags=["cache"])


@router.get("/status")
async def cache_status(current_user: CurrentUser):
    """Return current song cache status and statistics."""
    return song_cache.status()


@router.post("/refresh")
async def refresh_cache(current_user: CurrentUser):
    """Trigger a full song cache rebuild (runs in background)."""
    from app.core.task_registry import create_background_task

    create_background_task(song_cache.refresh_full(), name="song-cache-refresh")
    return {
        "message": "歌曲缓存刷新任务已启动",
        "status": song_cache.status(),
    }