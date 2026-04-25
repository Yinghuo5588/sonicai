"""Netease Music hotboard fetcher via uapis.cn."""

import httpx
import logging

logger = logging.getLogger(__name__)

UAPIS_ENDPOINT = "https://uapis.cn/api/v1/misc/hotboard"


async def fetch_netease_hotboard(limit: int = 200) -> list[dict]:
    """
    Fetch current NetEase Music hotboard.
    Returns list of hot track dicts with title, artist, album, cover, url.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(UAPIS_ENDPOINT, params={"type": "netease-music"})
            if response.status_code != 200:
                logger.warning(f"[hotboard] uapis HTTP {response.status_code}")
                return []
            data = response.json()

        items = data.get("list") or []
        results = []
        for item in items[:limit]:
            extra = item.get("extra") or {}
            results.append({
                "index": item.get("index"),
                "title": item.get("title", ""),
                "artist": extra.get("artist_names", ""),
                "album": extra.get("album", ""),
                "cover": item.get("cover", ""),
                "url": item.get("url", ""),
                "hot_value": item.get("hot_value", ""),
            })
        logger.info(f"[hotboard] fetched {len(results)} hot tracks from netease-music")
        return results
    except Exception:
        logger.exception("[hotboard] failed to fetch from uapis")
        return []