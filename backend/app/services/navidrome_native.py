"""Navidrome native API helpers.

This module is intentionally defensive:
- Native API is best-effort.
- If it fails, callers should fall back to existing Subsonic logic.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _base_url(url: str) -> str:
    return url.rstrip("/")


async def navidrome_native_login() -> str | None:
    """Authenticate with Navidrome native API and return a Bearer token."""
    from sqlalchemy import select
    from app.db.models import SystemSettings
    from app.core.crypto import decrypt_value
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        s = result.scalar_one_or_none()

    if not s or not s.navidrome_url or not s.navidrome_username or not s.navidrome_password_encrypted:
        return None

    password = decrypt_value(s.navidrome_password_encrypted)
    base = _base_url(s.navidrome_url)

    # Try common payload shapes
    payload_candidates = [
        {"username": s.navidrome_username, "password": password},
        {"user": s.navidrome_username, "password": password},
    ]

    async with httpx.AsyncClient(timeout=20) as client:
        for payload in payload_candidates:
            try:
                resp = await client.post(f"{base}/auth/login", json=payload)
                if resp.status_code >= 400:
                    continue

                data = resp.json()
                token = (
                    data.get("token")
                    or data.get("jwt")
                    or data.get("accessToken")
                    or data.get("access_token")
                )
                if token:
                    return str(token)
            except Exception as e:
                logger.debug("Navidrome native login failed: %s", e)

    return None


async def get_all_songs_native() -> list[dict[str, Any]]:
    """Fetch all songs through Navidrome native API.

    Returns an empty list when native API is unavailable.
    """
    from sqlalchemy import select
    from app.db.models import SystemSettings
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SystemSettings))
        s = result.scalar_one_or_none()

    if not s or not s.navidrome_url:
        return []

    token = await navidrome_native_login()
    if not token:
        return []

    base = _base_url(s.navidrome_url)
    headers = {
        "x-nd-authorization": f"Bearer {token}",
        "Authorization": f"Bearer {token}",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.get(f"{base}/api/song", headers=headers)
            if resp.status_code >= 400:
                logger.warning("Navidrome native /api/song failed: HTTP %s", resp.status_code)
                return []

            data = resp.json()

            if isinstance(data, list):
                return data

            if isinstance(data, dict):
                # Defensive: try common wrapper keys
                for key in ("songs", "items", "data", "rows"):
                    if isinstance(data.get(key), list):
                        return data[key]

            return []
        except Exception as e:
            logger.warning("Navidrome native /api/song unavailable: %s", e)
            return []