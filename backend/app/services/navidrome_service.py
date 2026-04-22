"""Navidrome API service."""

import base64
from datetime import datetime, timezone
from typing import Any
import httpx

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings


def _get_navidrome_credentials() -> tuple[str, str] | None:
    # Returns (url, auth_header) or None
    # Note: navidrome_password_encrypted is hashed with argon2, we store it but use
    # a separate approach - for now just use basic auth with decrypted password.
    # Since we hash with argon2 (one-way), we need to store password differently.
    # TODO: store navidrome password using a reversible encryption (e.g.Fernet)
    # For now, we'll store it as plain in a separate field or use env variable approach.
    return None


async def _get_navidrome_config() -> dict | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        settings = result.scalar_one_or_none()
    if not settings or not settings.navidrome_url:
        return None
    return {
        "url": settings.navidrome_url.rstrip("/"),
        "username": settings.navidrome_username or "",
        # Password stored in navidrome_password_encrypted (plain text for now - TODO: use Fernet)
        "password": settings.navidrome_password_encrypted or "",
    }


def _auth_header(username: str, password: str) -> str:
    credentials = f"{username}:{password}"
    return "Basic " + base64.b64encode(credentials.encode()).decode()


async def navidrome_get(endpoint: str) -> dict | None:
    config = await _get_navidrome_config()
    if not config:
        return None
    url = f"{config['url']}{endpoint}"
    headers = {"Authorization": _auth_header(config["username"], config["password"])}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
    return None


async def navidrome_search(query: str, limit: int = 10) -> list[dict]:
    config = await _get_navidrome_config()
    if not config:
        return []
    url = f"{config['url']}/api/session/search"
    headers = {"Authorization": _auth_header(config["username"], config["password"])}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(url, headers=headers, json={"query": query, "limit": limit})
            if response.status_code == 200:
                data = response.json()
                return data.get("artists", []) + data.get("songs", [])
        except Exception:
            pass
    return []


async def navidrome_create_playlist(name: str) -> str | None:
    config = await _get_navidrome_config()
    if not config:
        return None
    url = f"{config['url']}/api/playlist"
    headers = {
        "Authorization": _auth_header(config["username"], config["password"]),
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(url, headers=headers, json={"name": name})
            if response.status_code in (200, 201):
                return response.json().get("id")
        except Exception:
            pass
    return None


async def navidrome_add_to_playlist(playlist_id: str, song_ids: list[str]):
    config = await _get_navidrome_config()
    if not config:
        return False
    url = f"{config['url']}/api/playlist/{playlist_id}"
    headers = {
        "Authorization": _auth_header(config["username"], config["password"]),
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, headers=headers, json={"songIds": song_ids})
            return response.status_code in (200, 201)
        except Exception:
            return False


async def navidrome_delete_playlist(playlist_id: str) -> bool:
    config = await _get_navidrome_config()
    if not config:
        return False
    url = f"{config['url']}/api/playlist/{playlist_id}"
    headers = {"Authorization": _auth_header(config["username"], config["password"])}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.delete(url, headers=headers)
            return response.status_code == 204
        except Exception:
            return False


async def navidrome_list_playlists() -> list[dict]:
    data = await navidrome_get("/api/playlist")
    if isinstance(data, dict) and "playlists" in data:
        return data["playlists"]
    if isinstance(data, list):
        return data
    return []