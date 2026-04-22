"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging import *  # noqa: F401,F403
from app.api.routes import router as api_router

logger = logging.getLogger(__name__)

# Resolve frontend dist directory relative to backend/
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)  # sonicai/
_FRONTEND_DIST = os.path.join(_PROJECT_ROOT, "frontend", "dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SonicAI backend...")
    # Create initial admin if no users exist
    await _ensure_initial_admin()
    # Start scheduler
    start_scheduler()
    yield
    shutdown_scheduler()
    logger.info("SonicAI backend stopped")


app = FastAPI(
    title="SonicAI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api")


# Serve frontend static files at root
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
    logger.info(f"Serving frontend from: {_FRONTEND_DIST}")
else:
    logger.warning(f"Frontend dist not found at {_FRONTEND_DIST} — frontend will not be served")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/version")
async def version():
    return {"version": "1.0.0", "name": "SonicAI"}


async def _ensure_initial_admin():
    """Create initial admin user if no users exist."""
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import User
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        if result.scalars().first() is not None:
            return  # Users exist

        logger.info("No users found — creating initial admin")
        admin = User(
            username=settings.init_admin_username,
            email=settings.init_admin_email,
            password_hash=hash_password(settings.init_admin_password),
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
        await db.commit()
        logger.info(f"Initial admin created: {settings.init_admin_username}")
