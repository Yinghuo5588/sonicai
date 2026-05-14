"""AI preference profile routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.db.models import SystemSettings


router = APIRouter(prefix="/ai/preference-profile", tags=["ai"])


MAX_PROFILE_BYTES = 50 * 1024


class PreferenceProfileUpdateRequest(BaseModel):
    content: str = Field(default="", max_length=50000)
    filename: str | None = Field(default=None, max_length=255)
    enabled: bool | None = None


async def _get_settings(db: AsyncSession) -> SystemSettings:
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.flush()
    return settings


@router.get("")
async def get_ai_preference_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db)
    return {
        "enabled": bool(getattr(settings, "ai_preference_profile_enabled", True)),
        "filename": settings.ai_preference_profile_filename,
        "content": settings.ai_preference_profile_text or "",
        "updated_at": (
            settings.ai_preference_profile_updated_at.isoformat()
            if settings.ai_preference_profile_updated_at
            else None
        ),
    }


@router.put("")
async def update_ai_preference_profile(
    body: PreferenceProfileUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db)

    content = body.content or ""
    if len(content.encode("utf-8")) > MAX_PROFILE_BYTES:
        raise HTTPException(status_code=400, detail="偏好文件内容不能超过 50KB")

    if body.enabled is not None:
        settings.ai_preference_profile_enabled = body.enabled

    settings.ai_preference_profile_text = content
    settings.ai_preference_profile_filename = body.filename or "preference.md"
    settings.ai_preference_profile_updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "message": "AI 长期偏好已保存",
        "enabled": bool(settings.ai_preference_profile_enabled),
        "filename": settings.ai_preference_profile_filename,
        "updated_at": settings.ai_preference_profile_updated_at.isoformat(),
    }


@router.post("/upload")
async def upload_ai_preference_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    filename = file.filename or ""
    lower = filename.lower()

    if not (lower.endswith(".md") or lower.endswith(".txt")):
        raise HTTPException(status_code=400, detail="仅支持 .md 或 .txt 文件")

    content_bytes = await file.read()

    if len(content_bytes) > MAX_PROFILE_BYTES:
        raise HTTPException(status_code=400, detail="偏好文件不能超过 50KB")

    text_content: str | None = None
    for encoding in ("utf-8", "utf-8-sig", "gbk"):
        try:
            text_content = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if text_content is None:
        raise HTTPException(status_code=400, detail="文件编码无法识别，请使用 UTF-8 编码保存")

    settings = await _get_settings(db)
    settings.ai_preference_profile_enabled = True
    settings.ai_preference_profile_text = text_content
    settings.ai_preference_profile_filename = filename
    settings.ai_preference_profile_updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "message": "AI 长期偏好文件已上传",
        "filename": filename,
        "updated_at": settings.ai_preference_profile_updated_at.isoformat(),
    }


@router.delete("")
async def delete_ai_preference_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_settings(db)
    settings.ai_preference_profile_text = None
    settings.ai_preference_profile_filename = None
    settings.ai_preference_profile_updated_at = None

    await db.commit()

    return {"message": "AI 长期偏好已删除"}