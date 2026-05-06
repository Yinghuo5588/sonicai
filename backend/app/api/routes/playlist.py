"""Third-party playlist sync routes."""

import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from app.core.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import RecommendationRun
from app.api.deps import CurrentUser
from app.services.job_run_service import create_pending_run
from app.core.task_registry import create_background_task
from app.services.playlist_sync import run_playlist_sync, run_text_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playlist", tags=["playlist"])


@router.post("/sync")
@limiter.limit("3/minute")
async def sync_playlist(
    request: Request,
    url: str,
    current_user: CurrentUser,
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
):
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="url is required")

    run_id = await create_pending_run(
        run_type="playlist",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["playlist"],
        lock_scope="playlist",
        stale_after_minutes=10,
    )

    logger.info(f"[playlist] queued run_id={run_id} url={url} user_id={current_user.id}")
    create_background_task(
        run_playlist_sync(
            run_id=run_id,
            url=url.strip(),
            match_threshold=match_threshold,
            playlist_name=playlist_name,
            overwrite=overwrite,
        ),
        name=f"playlist-sync-{run_id}",
    )

    return {
        "message": "Playlist sync queued",
        "run_id": run_id,
        "url": url,
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(auto)",
        "overwrite": overwrite,
    }


@router.post("/sync-incremental")
@limiter.limit("3/minute")
async def sync_playlist_incremental(
    request: Request,
    current_user: CurrentUser,
):
    """
    Manually trigger an immediate incremental playlist sync.
    Uses the configured playlist_sync_url from settings.
    This is the same logic as the cron job, but triggered on-demand.
    """
    from app.services.playlist_incremental import run_incremental_playlist_sync
    from app.db.models import SystemSettings

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

    if not settings or not settings.playlist_sync_cron_enabled:
        raise HTTPException(status_code=400, detail="增量同步未启用，请在设置中开启")
    if not settings.playlist_sync_url:
        raise HTTPException(status_code=400, detail="未配置歌单同步 URL")

    run_id = await create_pending_run(
        run_type="playlist",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["playlist"],
        lock_scope="playlist",
        stale_after_minutes=10,
    )

    logger.info(f"[playlist_incremental] manual run_id={run_id} user_id={current_user.id}")
    create_background_task(
        run_incremental_playlist_sync(
            run_id=run_id,
            url=settings.playlist_sync_url,
            match_threshold=float(settings.playlist_sync_threshold or 0.75),
            playlist_name=settings.playlist_sync_name,
            overwrite=settings.playlist_sync_overwrite or False,
        ),
        name=f"playlist-incremental-{run_id}",
    )

    return {
        "message": "增量同步已提交",
        "run_id": run_id,
        "url": settings.playlist_sync_url,
    }

    return {
        "message": "Playlist sync queued",
        "run_id": run_id,
        "url": url,
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(auto)",
        "overwrite": overwrite,
    }


@router.post("/sync-text")
@limiter.limit("3/minute")
async def sync_text_playlist(
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
):
    """
    Upload a .txt file with format: 歌名 - 艺术家 (one per line).
    Syncs matched tracks to Navidrome.
    Supports any language: Chinese, Japanese, Korean, English, etc.
    """
    # 1. Validate file type
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="仅支持 .txt 文件")

    # 2. Read and decode file content
    content_bytes = await file.read()
    text_content: str | None = None
    for encoding in ("utf-8", "utf-8-sig", "gbk", "shift_jis", "euc-kr"):
        try:
            text_content = content_bytes.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    if text_content is None:
        raise HTTPException(
            status_code=400,
            detail="文件编码无法识别，请使用 UTF-8 编码保存"
        )

    # 3. Basic content validation
    lines = [
        l for l in text_content.strip().splitlines()
        if l.strip() and not l.strip().startswith("#")
    ]
    if len(lines) == 0:
        raise HTTPException(status_code=400, detail="文件中没有有效的歌曲行")
    if len(lines) > 500:
        raise HTTPException(status_code=400, detail="单次最多支持 500 首歌曲")

    run_id = await create_pending_run(
        run_type="playlist",
        current_user_id=current_user.id,
        trigger_type="manual",
        conflict_types=["playlist"],
        lock_scope="playlist",
        stale_after_minutes=10,
    )

    logger.info(
        f"[text_sync] queued run_id={run_id} "
        f"lines={len(lines)} user_id={current_user.id}"
    )

    # 4. Start background task
    create_background_task(
        run_text_sync(
            run_id=run_id,
            text_content=text_content,
            match_threshold=match_threshold,
            playlist_name=playlist_name,
            overwrite=overwrite,
        ),
        name=f"text-sync-{run_id}",
    )

    return {
        "message": "Text playlist sync queued",
        "run_id": run_id,
        "song_count": len(lines),
        "threshold": match_threshold,
        "playlist_name": playlist_name or "(自动: 文本歌单)",
        "overwrite": overwrite,
    }
