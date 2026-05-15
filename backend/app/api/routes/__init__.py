from fastapi import APIRouter
from app.api.routes import (
    auth,
    settings,
    jobs,
    runs,
    webhooks,
    dashboard,
    hotboard,
    playlist,
    cache,
    library,
    missed_tracks,
    tasks,
    ai,
    ai_preference,
    ai_jobs,
    playlist_sync_jobs,
)

router = APIRouter()
router.include_router(auth.router)
router.include_router(settings.router)
router.include_router(jobs.router)
router.include_router(runs.router)
router.include_router(webhooks.router)
router.include_router(dashboard.router)
router.include_router(hotboard.router)
router.include_router(playlist.router)
router.include_router(cache.router)
router.include_router(library.router)
router.include_router(missed_tracks.router)
router.include_router(tasks.router)
router.include_router(ai.router)
router.include_router(ai_preference.router)
router.include_router(ai_jobs.router)
router.include_router(playlist_sync_jobs.router)
