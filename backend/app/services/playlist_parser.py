"""Third-party playlist parser via configurable external API (e.g. unmeta.cn)."""

import re
import logging
import httpx
import urllib.parse

logger = logging.getLogger(__name__)

# Match a full URL (scheme + everything up to whitespace)
URL_RE = re.compile(r"https?://[^\s]+")

# Platforms that need the id-only URL (strip extra params like creatorId)
NETEASE_CLEAN_PARAMS = {"id"}


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
    raw_url = urls[0]

    # Normalize: extract only the `id` param for netease URLs (remove creatorId etc.)
    clean_url = _normalize_url(raw_url)

    # Build API URL with query params
    parsed = urllib.parse.urlparse(api_base)
    existing = dict(urllib.parse.parse_qsl(parsed.query))
    query_parts = [
        ("detailed", existing.get("detailed", "false")),
        ("format", existing.get("format", "song-singer")),
        ("order", existing.get("order", "normal")),
    ]
    api_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{urllib.parse.urlencode(query_parts)}"

    logger.info(f"[parser] API URL: {api_url}")
    logger.info(f"[parser] sending URL: {clean_url}")

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.post(
                api_url,
                data={"url": clean_url},
                headers={
                    "Accept": "application/json, text/plain, */*",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise ValueError(f"Playlist API 请求超时，请检查地址是否正确: {api_base}")
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 503:
            raise ValueError(f"Playlist API 服务暂时不可用（HTTP 503），可能是服务维护中，请稍后重试。地址: {api_base}")
        raise ValueError(f"Playlist API 返回错误 HTTP {status}: {api_base}")
    except httpx.RequestError as e:
        raise ValueError(f"Playlist API 连接失败: {e}。请检查地址是否可访问: {api_base}")
    except Exception as e:
        raise ValueError(f"Playlist API 请求失败: {e}")

    if data.get("code") == 1 and data.get("data"):
        name = data["data"].get("name", "第三方歌单")
        songs_raw = data["data"].get("songs", [])
        songs_count = data["data"].get("songs_count", len(songs_raw))
        logger.info(f"[parser] got playlist '{name}' with {songs_count} songs")
        songs = []
        for s in songs_raw:
            text = s if isinstance(s, str) else str(s)
            if " - " in text:
                title, rest = text.split(" - ", 1)
                artist = rest.replace(" / ", "/").strip()
            else:
                title = text.strip()
                artist = ""
            songs.append({"title": title.strip(), "artist": artist, "album": ""})
        return name, "netease", songs
    else:
        msg = data.get("msg", "unknown error")
        raise ValueError(
            f"Playlist API 返回异常: code={data.get('code')} msg={msg}。"
            "请检查歌单链接是否有效（私密歌单无法解析），或稍后重试。"
        )


def _normalize_url(url: str) -> str:
    """
    Strip platform-specific extra params from the URL.
    E.g. https://music.163.com/m/playlist?id=14199757875&creatorId=xxx
    → https://music.163.com/playlist?id=14199757875
    Also prefer the desktop /playlist path over /m/playlist.
    """
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qsl(parsed.query)

    # Normalize path: /m/playlist → /playlist for netease
    path = parsed.path.rstrip("/")
    if path.endswith("/m/playlist"):
        path = path.replace("/m/playlist", "/playlist")

    # Keep only `id` (strip creatorId, uin, etc.)
    id_params = [(k, v) for k, v in query if k == "id"]
    if not id_params:
        # Nothing to strip, return as-is
        return url

    normalized_query = urllib.parse.urlencode(id_params)
    return f"{parsed.scheme}://{parsed.netloc}{path}?{normalized_query}"


# ─────────────────────────────────────────────────────────────────────────────
# Text playlist parser
# ─────────────────────────────────────────────────────────────────────────────

_DASH_NORMALIZE = re.compile(r'\s*[－—–]\s*')


def parse_text_songs(text_content: str) -> tuple[str, str, list[dict]]:
    """
    Parse plain text content where each line is: title - artist
    Supports any language (Chinese, Japanese, Korean, English, etc.)

    Lines starting with # are treated as comments and skipped.
    Empty lines are skipped.

    Returns (playlist_name, platform, songs)
    """
    songs = []
    for line in text_content.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # Normalize various dash characters to standard " - "
        line = _DASH_NORMALIZE.sub(' - ', line)

        if " - " in line:
            title, artist = line.split(" - ", 1)
            title = title.strip()
            artist = artist.strip()
            if title and artist:
                songs.append({"title": title, "artist": artist, "album": ""})
            else:
                # title only — still accepted but match rate will be lower
                title = line.strip()
                if title:
                    songs.append({"title": title, "artist": "", "album": ""})
        else:
            title = line.strip()
            if title:
                songs.append({"title": title, "artist": "", "album": ""})

    logger.info(f"[text_parser] parsed {len(songs)} songs from text input")
    return "文本歌单", "text", songs
