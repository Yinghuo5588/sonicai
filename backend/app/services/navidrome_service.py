"""Navidrome API service — Subsonic protocol."""

import hashlib
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


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
    from app.core.crypto import decrypt_value

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
    if not settings or not settings.navidrome_url:
        return None
    return {
        "url": settings.navidrome_url.rstrip("/"),
        "username": settings.navidrome_username or "",
        "password": decrypt_value(settings.navidrome_password_encrypted or ""),
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
                logger.warning(f"[navidrome] HTTP {response.status_code} for {url}")
                return None
            data = response.json()
            resp = data.get("subsonic-response", data)
            if resp.get("status") == "failed":
                logger.warning(f"[navidrome] Subsonic error for {url}: {resp}")
                return None
            return resp
    except httpx.TimeoutException:
        logger.warning(f"[navidrome] timeout connecting to {url}")
        return None
    except Exception:
        logger.exception(f"[navidrome] request failed for {url}")
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def navidrome_ping() -> bool:
    """Test connectivity — returns True if Navidrome responds OK."""
    result = await _nd_get("ping.view")
    return result is not None


async def navidrome_search(query: str, limit: int = 10) -> list[dict]:
    """
    Search songs by raw query string.
    Returns list of song dicts with id, title, artist, album, duration.
    """
    result = await _nd_get("search3.view", {"query": query, "songCount": limit, "artistCount": 0, "albumCount": 0})
    if not result:
        return []

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


async def navidrome_multi_search(title: str, artist: str) -> list[dict]:
    """
    Multi-strategy search: try 8 query variants with priority.
    Returns all unique results collected across attempts (for scoring).
    Deduplicates by song id.
    """
    from app.utils.text_normalizer import make_search_queries

    queries = make_search_queries(title, artist)
    seen_ids: set[str] = set()
    all_results: list[dict] = []

    for idx, q_info in enumerate(queries):
        q = q_info["query"]
        label = q_info["label"]
        logger.debug(f"[navidrome] trying query '{q}' ({label})")
        results = await navidrome_search(q, limit=10)

        for r in results:
            rid = r.get("id")
            if rid and rid not in seen_ids:
                seen_ids.add(rid)
                r["_query_label"] = label
                all_results.append(r)

        # Early exit: first strategy hit ≥3 results → good enough
        if idx == 0 and len(all_results) >= 3:
            logger.debug(f"[navidrome] early exit: first strategy yielded {len(all_results)} results")
            break

        # Stop if we already have enough results (≥10 total) — any strategy
        if len(all_results) >= 10:
            logger.debug(f"[navidrome] early exit: accumulated {len(all_results)} results")
            break

    logger.info(f"[navidrome] multi_search title={title} artist={artist} queries_tried={min(idx + 1, len(queries))} results_total={len(all_results)}")
    return all_results


async def navidrome_list_playlists() -> list[dict]:
    """List all playlists."""
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
    result = await _nd_get("createPlaylist.view", {"name": name})
    if not result:
        return None
    playlist = result.get("playlist", {})
    return str(playlist.get("id", "")) or None


async def navidrome_add_to_playlist(playlist_id: str, song_ids: list[str]) -> bool:
    """Add songs to a playlist by ID. Supports batch via multiple songIdToAdd params."""
    if not song_ids:
        return True

    config = await _navidrome_config()
    if not config:
        return False

    username = config["username"]
    password = config["password"]
    if not username or not password:
        return False

    auth_params = _subsonic_params(username, password)
    url = f"{config['url']}/rest/updatePlaylist.view"

    # Use list[tuple] to ensure multiple same-named keys are encoded correctly
    param_list: list[tuple[str, str]] = list(auth_params.items())
    param_list.append(("playlistId", playlist_id))
    for sid in song_ids:
        param_list.append(("songIdToAdd", sid))

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=param_list)
            if response.status_code != 200:
                logger.warning(f"[navidrome] add_to_playlist HTTP {response.status_code}")
                return False
            data = response.json()
            resp = data.get("subsonic-response", data)
            if resp.get("status") == "failed":
                logger.warning(f"[navidrome] add_to_playlist error: {resp}")
                return False
            return True
    except Exception:
        logger.exception("[navidrome] add_to_playlist request failed")
        return False


async def navidrome_delete_playlist(playlist_id: str) -> bool:
    """Delete a playlist by ID."""
    result = await _nd_get("deletePlaylist.view", {"id": playlist_id})
    return result is not None