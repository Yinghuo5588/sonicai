"""System settings routes."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
import json
import httpx

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
    playlist_api: str | None
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
    seed_source_mode: str | None = None
    recent_tracks_limit: int | None = None
    top_period: str | None = None
    recent_top_mix_ratio: int | None = None
    match_threshold: float | None = None
    candidate_pool_multiplier_min: float | None = None
    candidate_pool_multiplier_max: float | None = None
    cron_enabled: bool
    cron_expression: str | None

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def empty_strings_to_none(cls, values):
        return {k: (None if v == "" else v) for k, v in values.items()}

    timezone: str | None = None
    lastfm_api_key: str | None = None
    lastfm_username: str | None = None
    navidrome_url: str | None = None
    navidrome_username: str | None = None
    navidrome_password: str | None = None
    webhook_url: str | None = None
    webhook_headers_json: str | None = None
    webhook_timeout_seconds: int | None = Field(default=None, ge=1, le=120)
    webhook_retry_count: int | None = Field(default=None, ge=0, le=10)
    playlist_keep_days: int | None = Field(default=None, ge=0, le=365)
    playlist_api: str | None = None
    library_mode_default: str | None = None
    duplicate_avoid_days: int | None = Field(default=None, ge=0, le=365)
    top_track_seed_limit: int | None = Field(default=None, ge=1, le=200)
    top_artist_seed_limit: int | None = Field(default=None, ge=1, le=200)
    similar_track_limit: int | None = Field(default=None, ge=1, le=100)
    similar_artist_limit: int | None = Field(default=None, ge=1, le=100)
    artist_top_track_limit: int | None = Field(default=None, ge=1, le=20)
    similar_playlist_size: int | None = Field(default=None, ge=1, le=500)
    artist_playlist_size: int | None = Field(default=None, ge=1, le=500)
    recommendation_balance: int | None = Field(default=None, ge=0, le=100)
    seed_source_mode: str | None = Field(default=None)
    recent_tracks_limit: int | None = Field(default=None, ge=10, le=1000)
    top_period: str | None = Field(default=None)
    recent_top_mix_ratio: int | None = Field(default=None, ge=0, le=100)
    match_threshold: float | None = Field(default=None, ge=0.5, le=0.95)
    candidate_pool_multiplier_min: float | None = Field(default=None, ge=1.0, le=20.0)
    candidate_pool_multiplier_max: float | None = Field(default=None, ge=1.0, le=20.0)
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
            # Validate library_mode_default enum
            if key == "library_mode_default" and value not in {"library_only", "allow_missing"}:
                raise HTTPException(status_code=400, detail="library_mode_default must be one of: library_only, allow_missing")
            # Validate seed_source_mode enum
            if key == "seed_source_mode" and value not in {"recent_only", "top_only", "recent_plus_top"}:
                raise HTTPException(status_code=400, detail="seed_source_mode must be one of: recent_only, top_only, recent_plus_top")
            # Validate top_period enum
            if key == "top_period" and value not in {"7day", "1month", "3month", "6month", "12month", "overall"}:
                raise HTTPException(status_code=400, detail="top_period must be one of: 7day, 1month, 3month, 6month, 12month, overall")
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

    # Reload cron schedule after config change
    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    return SettingsResponse.model_validate(s)


@router.post("/test-lastfm")
async def test_lastfm(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)
    if not s.lastfm_api_key or not s.lastfm_username:
        raise HTTPException(status_code=400, detail="Last.fm API key or username not configured")
    # Actually test the API
    from app.services.lastfm_service import get_user_top_tracks
    try:
        tracks = await get_user_top_tracks(s.lastfm_username, limit=1)
        return {"status": "ok", "message": f"Last.fm 连通成功，用户：{s.lastfm_username}，最近一首：{tracks[0]['name'] if tracks else '(无)'}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Last.fm 连接失败：{str(e)}")


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

    headers = {}
    if s.webhook_headers_json:
        try:
            headers = json.loads(s.webhook_headers_json)
        except Exception:
            raise HTTPException(status_code=400, detail="webhook_headers_json 格式错误，需为合法 JSON")

    test_payload = {"event": "test", "message": "SonicAI connectivity test"}
    try:
        timeout = float(s.webhook_timeout_seconds or 10)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                s.webhook_url,
                json=test_payload,
                headers={**headers, "Content-Type": "application/json"},
            )
        if response.status_code < 400:
            return {"status": "ok", "message": f"Webhook 连通成功 (HTTP {response.status_code})"}
        raise HTTPException(
            status_code=400,
            detail=f"Webhook 返回错误 (HTTP {response.status_code}): {response.text[:200]}"
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=400, detail=f"Webhook 连接超时（{int(timeout)}秒）")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook 连接失败: {str(e)}")