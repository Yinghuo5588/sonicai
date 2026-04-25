"""FastAPI application entry point."""

import logging
import os
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging import *  # noqa: F401,F403
from app.api.routes import router as api_router

logger = logging.getLogger(__name__)

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_FRONTEND_DIST = os.path.join(_PROJECT_ROOT, "frontend", "dist")


def _run_alembic_upgrade():
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd="/app",
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            logger.info("Alembic migration completed successfully")
        else:
            logger.warning(f"Alembic migration output: {result.stdout} {result.stderr}")
    except Exception as e:
        logger.warning(f"Alembic migration failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SonicAI backend...")
    import asyncio
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _run_alembic_upgrade)
    #
    await _ensure_initial_admin()
    start_scheduler()
    from app.core.scheduler import load_cron_schedule
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await load_cron_schedule(db)
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

# SPA static files — mounted at /assets for JS/CSS, NOT as catch-all
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST), name="frontend-assets")
    logger.info(f"Serving frontend assets from: {_FRONTEND_DIST}/assets")
else:
    logger.warning(f"Frontend dist not found at {_FRONTEND_DIST} — frontend will not be served")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/version")
async def version():
    return {"version": "1.0.0", "name": "SonicAI"}


# Catch-all: serve index.html for any non-API GET (supports SPA refresh /playlist-sync, etc.)
@app.get("/{path:path}", tags=["spa"])
async def spa_fallback(path: str):
    """Serve index.html for client-side routes (SPA refresh, direct links)."""
    if path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")
    index_path = os.path.join(_FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    logger.warning(f"index.html not found at {index_path}")
    raise HTTPException(status_code=404, detail="Frontend not built")


async def _ensure_initial_admin():
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import User
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        if result.scalars().first() is not None:
            return

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
