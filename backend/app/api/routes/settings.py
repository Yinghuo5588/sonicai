"""System settings routes."""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Any
import json
import httpx

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import SystemSettings
from app.api.deps import CurrentUser
from app.core.crypto import encrypt_value

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
    playlist_api_url: str | None
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
    match_mode: str | None = "full"
    candidate_pool_multiplier_min: float | None = None
    candidate_pool_multiplier_max: float | None = None
    search_concurrency: int | None = None
    max_concurrent_tasks: int | None = None
    cron_enabled: bool
    cron_expression: str | None
    recommendation_cron_run_type: str | None = "full"
    # Hotboard scheduled sync
    hotboard_cron_enabled: bool | None = False
    hotboard_cron_expression: str | None = None
    hotboard_limit: int | None = 50
    hotboard_match_threshold: float | None = None
    hotboard_playlist_name: str | None = None
    hotboard_overwrite: bool | None = True
    # Playlist URL scheduled sync
    playlist_sync_cron_enabled: bool | None = False
    playlist_sync_cron_expression: str | None = None
    playlist_sync_url: str | None = None
    playlist_sync_threshold: float | None = None
    playlist_sync_name: str | None = None
    playlist_sync_overwrite: bool | None = False

    # Song cache
    song_cache_enabled: bool | None = True
    song_cache_auto_refresh_enabled: bool | None = True
    song_cache_refresh_cron: str | None = "0 4 * * *"

    # Missed track retry
    missed_track_retry_mode: str | None = "local"
    missed_track_retry_enabled: bool | None = False
    missed_track_retry_cron: str | None = "0 3 * * *"
    missed_track_retry_limit: int | None = 100
    missed_track_retry_refresh_library: bool | None = True

    match_debug_enabled: bool | None = False

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
    playlist_api_url: str | None = None
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
    match_mode: str | None = None
    candidate_pool_multiplier_min: float | None = Field(default=None, ge=1.0, le=20.0)
    candidate_pool_multiplier_max: float | None = Field(default=None, ge=1.0, le=20.0)
    search_concurrency: int | None = Field(default=None, ge=1, le=20)
    max_concurrent_tasks: int | None = Field(default=None, ge=1, le=5)
    cron_enabled: bool | None = None
    cron_expression: str | None = None
    recommendation_cron_run_type: str | None = None
    # Hotboard scheduled sync
    hotboard_cron_enabled: bool | None = False
    hotboard_cron_expression: str | None = None
    hotboard_limit: int | None = 50
    hotboard_match_threshold: float | None = None
    hotboard_playlist_name: str | None = None
    hotboard_overwrite: bool | None = True
    # Playlist URL scheduled sync
    playlist_sync_cron_enabled: bool | None = False
    playlist_sync_cron_expression: str | None = None
    playlist_sync_url: str | None = None
    playlist_sync_threshold: float | None = None
    playlist_sync_name: str | None = None
    playlist_sync_overwrite: bool | None = False

    # Song cache
    song_cache_enabled: bool | None = None
    song_cache_auto_refresh_enabled: bool | None = None
    song_cache_refresh_cron: str | None = None

    # Missed track retry
    missed_track_retry_enabled: bool | None = None
    missed_track_retry_cron: str | None = None
    missed_track_retry_limit: int | None = Field(default=None, ge=1, le=1000)
    missed_track_retry_refresh_library: bool | None = None
    missed_track_retry_mode: str | None = None

    match_debug_enabled: bool | None = None



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
        if key == "navidrome_password":
            setattr(s, "navidrome_password_encrypted", encrypt_value(value) if value else None)
            continue
        # Validate enum fields
        if key == "library_mode_default" and value not in {"library_only", "allow_missing"}:
            raise HTTPException(status_code=400, detail="library_mode_default must be one of: library_only, allow_missing")
        if key == "seed_source_mode" and value not in {"recent_only", "top_only", "recent_plus_top"}:
            raise HTTPException(status_code=400, detail="seed_source_mode must be one of: recent_only, top_only, recent_plus_top")
        if key == "top_period" and value not in {"7day", "1month", "3month", "6month", "12month", "overall"}:
            raise HTTPException(status_code=400, detail="top_period must be one of: 7day, 1month, 3month, 6month, 12month, overall")
        if key == "match_mode" and value not in {"full", "local_only"}:
            raise HTTPException(status_code=400, detail="match_mode must be one of: full, local_only")
        if key == "missed_track_retry_mode" and value not in {"local", "api"}:
            raise HTTPException(status_code=400, detail="missed_track_retry_mode must be one of: local, api")
        if key == "recommendation_cron_run_type" and value not in {"full", "similar_tracks", "similar_artists"}:
            raise HTTPException(status_code=400, detail="recommendation_cron_run_type must be one of: full, similar_tracks, similar_artists")
        if (key.endswith("_cron_expression") or key.endswith("_cron")) and value:
            parts = str(value).split()
            if len(parts) != 5:
                raise HTTPException(status_code=400, detail=f"{key} must be a valid 5-field cron expression")
        if key == "webhook_headers_json" and value:
            try:
                json.loads(value)
            except Exception:
                raise HTTPException(status_code=400, detail="webhook_headers_json must be valid JSON")
        # All other fields (including None) are saved as-is
        setattr(s, key, value)
    await db.commit()
    await db.refresh(s)

    # Reload full cron schedule (all three: recommendation + hotboard + playlist_sync)
    from app.core.scheduler import load_cron_schedule
    await load_cron_schedule(db)

    # Refresh task semaphore if max_concurrent_tasks changed
    if body.max_concurrent_tasks is not None:
        from app.core.task_registry import set_max_concurrent
        set_max_concurrent(body.max_concurrent_tasks)

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


@router.get("/export")
async def export_settings(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    s = await get_settings_session(db)

    # Build dict manually to avoid SQLAlchemy internal state
    data = {}
    for col in s.__table__.columns:
        key = col.name
        val = getattr(s, key)
        if isinstance(val, datetime):
            val = val.isoformat()
        elif isinstance(val, Decimal):
            val = float(val)
        data[key] = val

    # Remove metadata fields
    data.pop("id", None)
    data.pop("created_at", None)
    data.pop("updated_at", None)

    return JSONResponse(content={
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": data
    })


class SettingsImportRequest(BaseModel):
    settings: dict[str, Any]


@router.post("/import")
async def import_settings(
    body: SettingsImportRequest,
    current_user: CurrentUser,
    db: AsyncSessionLocal = Depends(get_db)
):
    s = await get_settings_session(db)
    import_data = body.settings

    # All columns except id and metadata
    allowed_fields = {col.name for col in s.__table__.columns} - {"id", "created_at", "updated_at"}

    # Fields that must be numeric
    numeric_fields = {
        "webhook_timeout_seconds", "webhook_retry_count", "playlist_keep_days",
        "top_track_seed_limit", "top_artist_seed_limit", "similar_track_limit",
        "similar_artist_limit", "artist_top_track_limit", "similar_playlist_size",
        "artist_playlist_size", "recommendation_balance", "recent_tracks_limit",
        "recent_top_mix_ratio", "search_concurrency", "hotboard_limit",
        "match_threshold", "candidate_pool_multiplier_min", "candidate_pool_multiplier_max",
        "hotboard_match_threshold", "playlist_sync_threshold", "duplicate_avoid_days",
        "missed_track_retry_limit",
    }

    # Fields that are enum-validated
    enum_fields = {
        "library_mode_default": {"library_only", "allow_missing"},
        "seed_source_mode": {"recent_only", "top_only", "recent_plus_top"},
        "top_period": {"7day", "1month", "3month", "6month", "12month", "overall"},
        "match_mode": {"full", "local_only"},
        "missed_track_retry_mode": {"local", "api"},
        "recommendation_cron_run_type": {"full", "similar_tracks", "similar_artists"},
    }

    updated_fields = []
    for key, value in import_data.items():
        if key not in allowed_fields:
            continue

        # Empty string → None
        if value == "":
            value = None

        # Skip None values (retain current value)
        if value is None:
            continue

        # Numeric validation
        if key in numeric_fields:
            if not isinstance(value, (int, float)):
                raise HTTPException(status_code=400, detail=f"字段 {key} 必须是数字")

        # Enum validation
        if key in enum_fields:
            if value not in enum_fields[key]:
                raise HTTPException(status_code=400, detail=f"字段 {key} 必须是: {', '.join(enum_fields[key])}")

        # Cron expression basic validation (5 fields)
        if key.endswith("_cron_expression") or key.endswith("_cron"):
            parts = str(value).split()
            if len(parts) != 5:
                raise HTTPException(status_code=400, detail=f"字段 {key} 的 Cron 表达式无效")

        # webhook_headers_json must be valid JSON
        if key == "webhook_headers_json":
            try:
                json.loads(value)
            except Exception:
                raise HTTPException(status_code=400, detail="webhook_headers_json 格式错误，需为合法 JSON")

        setattr(s, key, value)
        updated_fields.append(key)

    if updated_fields:
        await db.commit()
        await db.refresh(s)
        # Reload cron schedule so new定时任务 take effect
        from app.core.scheduler import load_cron_schedule
        await load_cron_schedule(db)

    return {"message": "配置导入成功", "updated_fields": updated_fields}


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