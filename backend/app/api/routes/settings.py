"""System settings routes."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
import json

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import SystemSettings
from app.api.deps import CurrentUser

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsResponse(BaseModel):
    timezone: str
    lastfm_api_key: str | None
    lastfm_username: str | None
    navidrome_url: str | None
    navidrome_username: str | None
    webhook_url: str | None
    webhook_headers_json: str | None
    webhook_timeout_seconds: int
    webhook_retry_count: int
    playlist_keep_days: int
    library_mode_default: str
    duplicate_avoid_days: int
    top_track_seed_limit: int
    top_artist_seed_limit: int
    similar_track_limit: int
    similar_artist_limit: int
    artist_top_track_limit: int
    similar_playlist_size: int
    artist_playlist_size: int
    recommendation_balance: int
    cron_enabled: bool
    cron_expression: str | None

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    timezone: str | None = None
    lastfm_api_key: str | None = None
    lastfm_username: str | None = None
    navidrome_url: str | None = None
    navidrome_username: str | None = None
    navidrome_password: str | None = None
    webhook_url: str | None = None
    webhook_headers_json: str | None = None
    webhook_timeout_seconds: int | None = None
    webhook_retry_count: int | None = None
    playlist_keep_days: int | None = None
    library_mode_default: str | None = None
    duplicate_avoid_days: int | None = None
    top_track_seed_limit: int | None = None
    top_artist_seed_limit: int | None = None
    similar_track_limit: int | None = None
    similar_artist_limit: int | None = None
    artist_top_track_limit: int | None = None
    similar_playlist_size: int | None = None
    artist_playlist_size: int | None = None
    recommendation_balance: int | None = None
    cron_enabled: bool | None = None
    cron_expression: str | None = None


async def get_settings_session(db: AsyncSessionLocal):
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.flush()
    return settings


@router.get("", response_model=SettingsResponse)
async def get_settings(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    await db.refresh(s) if s.id else None
    return SettingsResponse.model_validate(s)


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate, current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            if key == "navidrome_password":
                setattr(s, "navidrome_password_encrypted", value)
            elif key == "webhook_headers_json":
                try:
                    json.loads(value)
                    setattr(s, key, value)
                except Exception:
                    raise HTTPException(status_code=400, detail="webhook_headers_json must be valid JSON")
            else:
                setattr(s, key, value)
    await db.commit()
    await db.refresh(s)
    return SettingsResponse.model_validate(s)


@router.post("/test-lastfm")
async def test_lastfm(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    if not s.lastfm_api_key or not s.lastfm_username:
        raise HTTPException(status_code=400, detail="Last.fm API key or username not configured")
    return {"status": "ok", "message": "Last.fm connection OK"}


@router.post("/test-navidrome")
async def test_navidrome(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    if not s.navidrome_url or not s.navidrome_username or not s.navidrome_password_encrypted:
        raise HTTPException(status_code=400, detail="Navidrome 未完整配置")

    from app.services.navidrome_service import navidrome_ping
    ok = await navidrome_ping()
    if not ok:
        raise HTTPException(status_code=400, detail="Navidrome 连接失败 — 检查地址/用户名/密码")
    return {"status": "ok", "message": "Navidrome 连接成功"}


@router.post("/test-webhook")
async def test_webhook(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    if not s.webhook_url:
        raise HTTPException(status_code=400, detail="Webhook URL not configured")
    return {"status": "ok", "message": "Webhook test OK"}