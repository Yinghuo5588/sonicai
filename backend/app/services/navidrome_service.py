"""Navidrome API service — Subsonic protocol."""

import hashlib
import httpx
from typing import Any


# ── Auth helpers ───────────────────────────────────────────────────────────────

def _md5(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def _subsonic_params(username: str, password: str, extra: dict[str, Any] | None = None) -> dict[str, str]:
    """Build Subsonic auth params: t=token, s=salt, plus fixed version params."""
    import secrets
    salt = secrets.token_hex(8)
    token = _md5(password + salt)
    params = {
        "u": username,
        "t": token,
        "s": salt,
        "v": "1.16.1",
        "c": "sonicai",
        "f": "json",
    }
    if extra:
        params.update(extra)
    return params


# ── Config helper ───────────────────────────────────────────────────────────────

async def _navidrome_config() -> dict | None:
    """Load Navidrome config from system_settings."""
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.db.models import SystemSettings

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
    if not settings or not settings.navidrome_url:
        return None
    return {
        "url": settings.navidrome_url.rstrip("/"),
        "username": settings.navidrome_username or "",
        # Stored as argon2 hash — we need plain password.
        # TODO: store navidrome password with Fernet encryption (not argon2).
        # For now, treat navidrome_password_encrypted as the plain password.
        "password": settings.navidrome_password_encrypted or "",
    }


# ── Core request ────────────────────────────────────────────────────────────────

async def _nd_get(endpoint: str, params: dict[str, Any] | None = None) -> dict | None:
    """Make an authenticated Subsonic API request."""
    config = await _navidrome_config()
    if not config:
        return None

    username = config["username"]
    password = config["password"]
    if not username or not password:
        return None

    auth_params = _subsonic_params(username, password, params)
    url = f"{config['url']}/rest/{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=auth_params)
            if response.status_code != 200:
                return None
            data = response.json()
            # Subsonic always returns { "subsonic-response": { ... } }
            resp = data.get("subsonic-response", data)
            if resp.get("status") == "failed":
                return None
            return resp
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def navidrome_ping() -> bool:
    """Test connectivity — returns True if Navidrome responds OK."""
    result = await _nd_get("ping.view")
    return result is not None


async def navidrome_search(query: str, limit: int = 10) -> list[dict]:
    """Search songs by query. Returns list of song dicts."""
    result = await _nd_get("search3.view", {"q": to_simplified(query), "limit": limit})
    if not result:
        return []

    # search3 returns { searchResult3: { song: [...] } }
    search_result = result.get("searchResult3", {})
    songs = search_result.get("song", [])
    if isinstance(songs, dict):
        songs = [songs]
    return [
        {
            "id": s.get("id"),
            "title": s.get("title"),
            "artist": s.get("artist"),
            "album": s.get("album"),
            "duration": s.get("duration"),
        }
        for s in songs
        if s.get("id")
    ]


async def navidrome_list_playlists() -> list[dict]:
    """List all playlists. Returns list of playlist dicts."""
    result = await _nd_get("getPlaylists.view")
    if not result:
        return []
    playlists = result.get("playlists", {}).get("playlist", [])
    if isinstance(playlists, dict):
        playlists = [playlists]
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "comment": p.get("comment"),
            "owner": p.get("owner"),
            "public": p.get("public"),
            "songCount": p.get("songCount"),
            "created": p.get("created"),
            "changed": p.get("changed"),
        }
        for p in playlists
        if p.get("id")
    ]


async def navidrome_create_playlist(name: str) -> str | None:
    """Create a new playlist. Returns the new playlist ID or None."""
    # Subsonic createPlaylist requires name param, returns the new playlist id
    result = await _nd_get("createPlaylist.view", {"name": name})
    if not result:
        return None
    playlist = result.get("playlist", {})
    return str(playlist.get("id", "")) or None


async def navidrome_add_to_playlist(playlist_id: str, song_ids: list[str]) -> bool:
    """Add songs to a playlist by ID."""
    if not song_ids:
        return True
    result = await _nd_get(
        "updatePlaylist.view",
        {"playlistId": playlist_id, "songIdToAdd": song_ids},
    )
    return result is not None


async def navidrome_delete_playlist(playlist_id: str) -> bool:
    """Delete a playlist by ID."""
    result = await _nd_get("deletePlaylist.view", {"id": playlist_id})
    return result is not None
