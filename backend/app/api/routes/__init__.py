"""API routes."""

from fastapi import APIRouter
from app.api.routes import auth, settings, jobs, runs, webhooks, dashboard, hotboard

router = APIRouter()
router.include_router(auth.router)
router.include_router(settings.router)
router.include_router(jobs.router)
router.include_router(runs.router)
router.include_router(webhooks.router)
router.include_router(dashboard.router)
router.include_router(hotboard.router)