"""FastAPI application entry point."""

import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import start_scheduler, shutdown_scheduler
from app.core.logging import *  # noqa: F401,F403
from app.core.rate_limit import limiter
from app.api.routes import router as api_router
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

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

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
    """Deep health check — verify DB connectivity."""
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import text
    from fastapi.responses import JSONResponse

    db_ok = False
    db_error = None
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)

    status = "ok" if db_ok else "degraded"
    result = {
        "status": status,
        "version": "1.0.0",
        "checks": {
            "database": {"ok": db_ok},
        },
    }
    if db_error:
        result["checks"]["database"]["error"] = db_error

    status_code = 200 if db_ok else 503
    return JSONResponse(content=result, status_code=status_code)


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
