"""Last.fm API service."""

import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx

from app.db.session import AsyncSessionLocal
from app.db.models import LastfmCache


LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"


from sqlalchemy import select

async def _get_cached(cache_key: str) -> dict | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LastfmCache).where(LastfmCache.cache_key == cache_key)
        )
        row = result.scalar_one_or_none()
        if row and row.expires_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            return json.loads(row.payload_json)
    return None


async def _set_cached(cache_key: str, cache_type: str, payload: dict, ttl_seconds: int = 3600):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LastfmCache).where(LastfmCache.cache_key == cache_key)
        )
        existing = result.scalar_one_or_none()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        if existing:
            existing.payload_json = json.dumps(payload)
            existing.expires_at = expires_at
        else:
            db.add(LastfmCache(
                cache_key=cache_key,
                cache_type=cache_type,
                payload_json=json.dumps(payload),
                expires_at=expires_at,
            ))
        await db.commit()


async def lastfm_get(method: str, params: dict[str, Any]) -> dict | None:
    """Make a Last.fm API request with caching."""
    from app.db.models import SystemSettings

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()

    api_key = settings.lastfm_api_key if settings else None
    if not api_key:
        return None

    cache_key = f"{method}:{json.dumps(params, sort_keys=True)}"
    cached = await _get_cached(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(LASTFM_BASE, params={
            "method": method,
            "api_key": api_key,
            "format": "json",
            **params,
        })
        if response.status_code != 200:
            return None
        data = response.json()

    await _set_cached(cache_key, method, data, ttl_seconds=1800)
    return data


async def get_user_top_tracks(username: str, limit: int = 30, period: str = "1month") -> list[dict]:
    data = await lastfm_get("user.getTopTracks", {"user": username, "limit": limit, "period": period})
    if not data or not isinstance(data, dict) or "toptracks" not in data:
        return []
    toptracks = data.get("toptracks")
    if not isinstance(toptracks, dict):
        return []
    return toptracks.get("track", [])


async def get_user_top_artists(username: str, limit: int = 30, period: str = "1month") -> list[dict]:
    data = await lastfm_get("user.getTopArtists", {"user": username, "limit": limit, "period": period})
    if not data or not isinstance(data, dict) or "topartists" not in data:
        return []
    topartists = data.get("topartists")
    if not isinstance(topartists, dict):
        return []
    return topartists.get("artist", [])


async def get_user_recent_tracks(username: str, limit: int = 100) -> list[dict]:
    """Get user's recently played tracks."""
    data = await lastfm_get("user.getRecentTracks", {"user": username, "limit": limit})
    if not data or not isinstance(data, dict) or "recenttracks" not in data:
        return []
    recenttracks = data.get("recenttracks")
    if not isinstance(recenttracks, dict):
        return []
    tracks = recenttracks.get("track", [])
    return [t for t in tracks if isinstance(t, dict) and t.get("date", {}).get("uts")]


async def get_similar_tracks(track_name: str, artist_name: str, limit: int = 50) -> list[dict]:
    data = await lastfm_get("track.getSimilar", {
        "artist": artist_name,
        "track": track_name,
        "limit": limit,
    })
    if not data or not isinstance(data, dict) or "similartracks" not in data:
        return []
    similartracks = data.get("similartracks")
    if not isinstance(similartracks, dict):
        return []
    return similartracks.get("track", [])


async def get_similar_artists(artist_name: str, limit: int = 50) -> list[dict]:
    data = await lastfm_get("artist.getSimilar", {"artist": artist_name, "limit": limit})
    if not data or not isinstance(data, dict) or "similarartists" not in data:
        return []
    raw = data.get("similarartists", {})
    if isinstance(raw, dict):
        raw = [raw]
    elif not isinstance(raw, list):
        return []
    return raw


async def get_artist_top_tracks(artist_name: str, limit: int = 10) -> list[dict]:
    data = await lastfm_get("artist.getTopTracks", {"artist": artist_name, "limit": limit})
    if not data or not isinstance(data, dict) or "toptracks" not in data:
        return []
    toptracks = data.get("toptracks")
    if not isinstance(toptracks, dict):
        return []
    return toptracks.get("track", [])