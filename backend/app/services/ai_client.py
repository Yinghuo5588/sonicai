"""OpenAI-compatible AI client for music recommendation."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class AIClientError(RuntimeError):
    pass


def _normalize_base_url(base_url: str | None) -> str:
    url = (base_url or "https://api.openai.com/v1").strip().rstrip("/")
    if not url:
        url = "https://api.openai.com/v1"
    return url


async def call_openai_compatible_chat(
    *,
    api_key: str,
    base_url: str | None,
    model: str,
    messages: list[dict[str, str]],
    temperature: float = 0.8,
    timeout: float = 60.0,
    max_tokens: int = 2048,
) -> str:
    """
    Call OpenAI-compatible /chat/completions endpoint.

    Compatible with:
    - OpenAI
    - DeepSeek
    - Qwen OpenAI-compatible endpoint
    - Zhipu OpenAI-compatible endpoint
    - Ollama OpenAI-compatible endpoint
    - Groq / Mistral compatible endpoints
    """
    if not api_key:
        raise AIClientError("AI API key is not configured")

    if not model:
        raise AIClientError("AI model is not configured")

    url = f"{_normalize_base_url(base_url)}/chat/completions"

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code >= 400:
            raise AIClientError(
                f"AI API HTTP {resp.status_code}: {resp.text[:500]}"
            )

        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise AIClientError("AI API returned no choices")

        content = choices[0].get("message", {}).get("content")
        if not content:
            raise AIClientError("AI API returned empty content")

        return str(content).strip()

    except httpx.TimeoutException as e:
        raise AIClientError(f"AI API timeout after {timeout}s") from e
    except httpx.RequestError as e:
        raise AIClientError(f"AI API request failed: {e}") from e
    except AIClientError:
        raise
    except Exception as e:
        raise AIClientError(f"AI API unexpected error: {e}") from e


def parse_ai_songs_json(content: str) -> list[dict[str, Any]]:
    """
    Parse AI JSON response.

    Accepts:
    {
        "songs": [
            {"title": "...", "artist": "..."}
        ]
    }

    Also handles markdown fences and extra text around JSON.
    """
    if not content:
        return []

    text = content.strip()

    # Remove markdown code fences.
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Extract JSON object.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("[ai] failed to parse JSON: %s content=%s", e, text[:1000])
        return []

    if not isinstance(data, dict):
        return []

    songs = data.get("songs", [])
    if not isinstance(songs, list):
        return []

    valid: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for item in songs:
        if not isinstance(item, dict):
            continue

        title = str(item.get("title") or item.get("name") or "").strip()
        artist = str(item.get("artist") or "").strip()
        album = str(item.get("album") or "").strip()

        if not title:
            continue

        key = (title.lower(), artist.lower())
        if key in seen:
            continue
        seen.add(key)

        valid.append({
            "title": title,
            "artist": artist,
            "album": album,
            "raw": item,
        })

    return valid