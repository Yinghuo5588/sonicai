"""FastAPI application entry point."""

import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging import *  # noqa: F401,F403
from app.api.routes import router as api_router

logger = logging.getLogger(__name__)


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
    await _ensure_initial_admin()
    start_scheduler()
    from app.core.scheduler import load_cron_schedule
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        # Fallback: ensure playlist_api_url column exists even if alembic missed it
        try:
            from sqlalchemy import text
            await db.execute(text("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS playlist_api_url VARCHAR(500);"))
            await db.commit()
        except Exception:
            await db.rollback()
        await load_cron_schedule(db)
    yield
    shutdown_scheduler()
    logger.info("SonicAI backend stopped")


app = FastAPI(
    title="SonicAI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/version")
async def version():
    return {"version": "1.0.0", "name": "SonicAI"}


async def _ensure_initial_admin():
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import User
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        if result.scalars().first() is not None:
            return

        logger.info("No users found -- creating initial admin")
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
