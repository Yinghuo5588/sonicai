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
        mode: str = "free",
        preference_profile: str | None = None,
        favorite_tracks: list[dict] | None = None,
    ):
        super().__init__(context)
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.user_prompt = user_prompt.strip()
        self.limit = max(1, min(200, int(limit or 30)))
        self.temperature = max(0.0, min(2.0, float(temperature or 0.8)))
        self.timeout = max(10.0, min(300.0, float(timeout or 60.0)))
        self.mode = mode or "free"
        self.preference_profile = (preference_profile or "").strip()
        self.favorite_tracks = favorite_tracks or []

    async def default_playlist_name(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"AI 推荐 - {today}"

    def _build_messages(self) -> list[dict[str, str]]:
        system_prompt = f"""
你是 SonicAI 的音乐推荐 JSON API。

你的任务是根据用户需求生成歌曲候选列表。

严格要求:
- 只返回 JSON
- 不要 markdown
- 不要解释
- JSON 格式必须是:
{{
  "songs": [
    {{
      "title": "歌曲名",
      "artist": "歌手名",
      "album": "",
      "reason": "简短推荐理由",
      "mood": ["氛围标签"],
      "genre": ["风格标签"],
      "confidence": 0.85
    }}
  ]
}}
- 每首歌必须包含 title 和 artist
- album 不确定时填空字符串
- reason 用中文简短说明为什么推荐
- mood 和 genre 可以为空数组
- confidence 是 0 到 1 的数字
- 不要重复歌曲
- 尽量返回 {self.limit} 首
- 优先返回真实存在的歌曲和歌手，避免编造不存在的歌曲
- title 使用歌曲名，artist 使用主要艺术家名
""".strip()

        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt},
        ]

        if self.preference_profile:
            preference_prompt = f"""
以下是用户长期音乐偏好文件。
请尽量遵守其中的长期偏好、语种比例、风格偏好和避免项。
如果长期偏好和本次用户需求冲突，以本次用户需求为准。
但对于"不要 / 避免 / 不喜欢"的内容，请尽量避免。

用户长期偏好文件:
{self.preference_profile}
""".strip()

            messages.append({"role": "system", "content": preference_prompt})

        if self.mode == "favorites" and self.favorite_tracks:
            lines = []
            for idx, track in enumerate(self.favorite_tracks, start=1):
                title = str(track.get("title") or "").strip()
                artist = str(track.get("artist") or "").strip()
                album = str(track.get("album") or "").strip()

                if not title:
                    continue

                if artist and album:
                    lines.append(f"{idx}. {artist} - {title} ({album})")
                elif artist:
                    lines.append(f"{idx}. {artist} - {title}")
                else:
                    lines.append(f"{idx}. {title}")

            favorites_prompt = f"""
以下是用户在 Navidrome 中收藏/喜欢的歌曲样本，用于推断用户的音乐偏好。
请根据这些歌曲推断用户偏好，并推荐相似但不同的歌曲。
这些收藏歌曲本身不要出现在推荐结果中。

收藏歌曲样本:
{chr(10).join(lines)}
""".strip()

            messages.append({"role": "system", "content": favorites_prompt})

        user_prompt = f"""
推荐模式:
{self.mode}

用户本次需求:
{self.user_prompt}

歌曲数量:
{self.limit}

请严格返回 JSON:
{{
  "songs": [
    {{
      "title": "歌曲名",
      "artist": "歌手名",
      "album": "",
      "reason": "推荐理由",
      "mood": ["标签"],
      "genre": ["风格"],
      "confidence": 0.85
    }}
  ]
}}
""".strip()

        messages.append({"role": "user", "content": user_prompt})

        return messages

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