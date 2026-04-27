"""Third-party playlist parser via configurable external API (e.g. unmeta.cn)."""

import re
import logging
import httpx

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://[^\s]+")


async def parse_playlist_url(url: str, api_base: str) -> tuple[str, str, list[dict]]:
    """
    Parse any supported playlist URL using the given external API.
    api_base: full URL of the parser endpoint, e.g. https://sss.unmeta.cn/songlist
    Returns (playlist_name, platform, songs)
    platform: 'netease' (always 'netease' when using external API)
    Raises ValueError if api_base is empty or the API call fails.
    """
    if not api_base:
        raise ValueError(
            "Playlist API 未配置，请在设置里填写 Playlist API 地址。"
            "例: https://sss.unmeta.cn/songlist"
        )

    urls = URL_RE.findall(url)
    if not urls:
        raise ValueError("unrecognized url format: " + url)
    clean_url = urls[0]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(api_base, data={"url": clean_url})
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise ValueError(f"Playlist API 请求超时，请检查地址是否正确: {api_base}")
    except httpx.HTTPStatusError as e:
        raise ValueError(f"Playlist API 返回错误 HTTP {e.response.status_code}: {api_base}")
    except Exception as e:
        raise ValueError(f"Playlist API 请求失败: {e}")

    if data.get("code") == 1 and data.get("data"):
        name = data["data"].get("name", "第三方歌单")
        songs_raw = data["data"].get("songs", [])
        songs = []
        for s in songs_raw:
            # unmeta format: "标题 - 艺术家1 / 艺术家2"
            text = s if isinstance(s, str) else str(s)
            if " - " in text:
                title, rest = text.split(" - ", 1)
                artist = rest.replace(" / ", "/").strip()
            else:
                title = text.strip()
                artist = ""
            songs.append({"title": title.strip(), "artist": artist, "album": ""})
        logger.info("[playlist] unmeta '%s': %d songs", name, len(songs))
        return name, "netease", songs
    else:
        raise ValueError(
            f"Playlist API 返回异常: code={data.get('code')} msg={data.get('msg')}。"
            "请检查 API 地址是否正确，或联系 API 服务商。"
        )
