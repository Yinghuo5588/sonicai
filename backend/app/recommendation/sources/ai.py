"""AI recommendation source."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.recommendation.base import RecommendationSource, SourceContext
from app.recommendation.types import CandidateTrack
from app.services.ai_client import (
    call_openai_compatible_chat,
    parse_ai_songs_json,
)

logger = logging.getLogger(__name__)


class AIRecommendationSource(RecommendationSource):
    source_type = "ai"
    playlist_type = "ai_recommendation"

    display_name = "AI 推荐"
    description = "根据自然语言 prompt 使用 OpenAI-compatible API 生成歌曲候选。"
    is_dynamic = False
    supported_playlist_types = ("ai_recommendation",)

    def __init__(
        self,
        context: SourceContext,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
        user_prompt: str,
        limit: int = 30,
        temperature: float = 0.8,
        timeout: float = 60.0,
    ):
        super().__init__(context)
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.user_prompt = user_prompt.strip()
        self.limit = max(1, min(200, int(limit or 30)))
        self.temperature = max(0.0, min(2.0, float(temperature or 0.8)))
        self.timeout = max(10.0, min(300.0, float(timeout or 60.0)))

    async def default_playlist_name(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"AI 推荐 - {today}"

    def _build_messages(self) -> list[dict[str, str]]:
        system_prompt = f"""
你是一个音乐推荐 JSON API。

你的任务是根据用户需求生成歌曲候选列表。

严格要求:
- 只返回 JSON
- JSON 格式必须是: {{"songs": [{{"title": "...", "artist": "...", "album": ""}}]}}
- 每首歌必须包含 title 和 artist
- album 可以为空字符串
- 不要 markdown
- 不要解释
- 不要重复歌曲
- 尽量返回 {self.limit} 首
- 优先返回真实存在的歌曲和歌手
- title 使用歌曲名, artist 使用主要艺术家名
""".strip()

        user_prompt = f"""
用户需求:
{self.user_prompt}

歌曲数量:
{self.limit}

请返回 JSON:
{{
 "songs": [
   {{"title": "歌曲名", "artist": "歌手名", "album": ""}}
 ]
}}
""".strip()

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    async def fetch_candidates(self) -> list[CandidateTrack]:
        if not self.user_prompt:
            return []

        content = await call_openai_compatible_chat(
            api_key=self.api_key,
            base_url=self.base_url,
            model=self.model,
            messages=self._build_messages(),
            temperature=self.temperature,
            timeout=self.timeout,
            max_tokens=4096,
        )

        songs = parse_ai_songs_json(content)
        songs = songs[:self.limit]

        logger.info("[ai-source] parsed %s songs from AI response", len(songs))

        return [
            CandidateTrack(
                title=s["title"],
                artist=s.get("artist") or "",
                album=s.get("album") or "",
                score=idx + 1,
                source_type=self.source_type,
                source_seed_name="ai_prompt",
                source_seed_artist=None,
                rank_index=idx + 1,
                raw_payload={
                    "prompt": self.user_prompt,
                    "model": self.model,
                    "base_url": self.base_url,
                    "item": s.get("raw") or s,
                },
            )
            for idx, s in enumerate(songs)
        ]