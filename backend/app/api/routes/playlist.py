"""Third-party playlist sync routes."""

import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import RecommendationRun
from app.api.deps import CurrentUser
from app.core.task_registry import create_background_task
from app.services.playlist_sync import run_playlist_sync, run_text_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playlist", tags=["playlist"])


@router.post("/sync")
async def sync_playlist(
    url: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    match_threshold: float = 0.75,
    playlist_name: str | None = None,
    overwrite: bool = False,
):
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="url is required")

    from datetime import datetime, timezone, timedelta
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)

    async with db.begin_nested():
        # Clean stale running jobs
        stale_result = await db.execute(
            select(RecommendationRun).where(
                RecommendationRun.status == "running",
                RecommendationRun.run_type == "playlist",
                RecommendationRun.started_at < stale_cutoff,
            )
        )
        stale_rows = stale_result.scalars().all()
        if stale_rows:
            for row in stale_rows:
                row.status = "failed"
                row.error_message = "Stale job cleaned - auto-marked failed"
                row.finished_at = datetime.now(timezone.utc)

        # Atomic conflict check with row lock
        conflict = await db.execute(
            select(RecommendationRun.id).where(
                RecommendationRun.status.in_(["pending", "running"]),
                RecommendationRun.run_type == "playlist",
            )
            .with_for_update()
            .limit(1)
        )
        if conflict.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="A playlist sync is already running")

        run = RecommendationRun(
            run_type="playlist",
            trigger_type="manual",
            status="pending",
            created_by_user_id=current_user.id,
        )
        db.add(run)
        await db.flush()
        run_id = run.id

    await db.commit()

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


@router.post("/sync-text")
async def sync_text_playlist(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
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

    # 4. Clean stale running jobs and atomically check conflict
    from datetime import datetime, timezone, timedelta
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)

    async with db.begin_nested():
        stale_result = await db.execute(
            select(RecommendationRun).where(
                RecommendationRun.status == "running",
                RecommendationRun.run_type == "playlist",
                RecommendationRun.started_at < stale_cutoff,
            )
        )
        stale_rows = stale_result.scalars().all()
        if stale_rows:
            for row in stale_rows:
                row.status = "failed"
                row.error_message = "Stale job cleaned - auto-marked failed"
                row.finished_at = datetime.now(timezone.utc)

        # Atomic conflict check with row lock
        conflict = await db.execute(
            select(RecommendationRun.id).where(
                RecommendationRun.status.in_(["pending", "running"]),
                RecommendationRun.run_type == "playlist",
            )
            .with_for_update()
            .limit(1)
        )
        if conflict.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail="A playlist sync is already running"
            )

        run = RecommendationRun(
            run_type="playlist",
            trigger_type="manual",
            status="pending",
            created_by_user_id=current_user.id,
        )
        db.add(run)
        await db.flush()
        run_id = run.id

    await db.commit()

    logger.info(
        f"[text_sync] queued run_id={run_id} "
        f"lines={len(lines)} user_id={current_user.id}"
    )

    # 5. Start background task
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
