"""Parse third-party playlist URLs (NetEase, QQ, Douyin/Qishui) into song lists."""

import re
import json
import time
import logging
import hashlib
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ── NetEase Music ──────────────────────────────────────────────────────────────

NETEASE_API = "https://music.163.com/api/v6/playlist/detail"
NETEASE_DETAIL_API = "https://music.163.com/api/v3/song/detail"
NETEASE_SONG_API = "https://music.163.com/api/song/detail"


def extract_netease_id(url: str) -> str | None:
    # Always prefer the id= query param first
    m = re.search(r"id=(\d+)", url)
    if m:
        return m.group(1)
    # Fall back to trailing numeric ID
    m = re.search(r"/(\d+)(?:/|$)", url)
    if m:
        return m.group(1)
    return None


async def fetch_netease_playlist(playlist_id: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://music.163.com/",
    }
    async with httpx.AsyncClient(timeout=20.0, headers=headers, follow_redirects=True) as client:
        resp = await client.post(
            NETEASE_API,
            content=("id=" + playlist_id).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": headers["User-Agent"]},
        )
        resp.raise_for_status()
        text = resp.text
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning(f"[playlist] netease API returned non-JSON (pos %d): {text[:200]!r}", e.pos)
            raise ValueError(f"netease API returned invalid JSON: {e}") from e


NETEASE_SONG_API = "https://music.163.com/api/song/detail"

async def _fetch_netease_song_details(ids: list[dict]) -> dict:
    """Fetch song details using /api/song/detail (simpler comma-separated ids format)."""
    song_ids = [str(item["id"]) for item in ids]
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://music.163.com/",
    }
    params = {"ids": ",".join(song_ids), "types": ",".join(["1"] * len(song_ids))}
    async with httpx.AsyncClient(timeout=20.0, headers=headers, follow_redirects=True) as client:
        resp = await client.get(NETEASE_SONG_API, params=params)
        resp.raise_for_status()
        try:
            return resp.json()
        except json.JSONDecodeError as e:
            logger.warning(f"[playlist] netease song detail returned non-JSON (pos %d): {resp.text[:200]!r}", e.pos)
            raise ValueError(f"netease song detail returned invalid JSON: {e}") from e


def _parse_netease_details(data: dict) -> list[dict]:
    # /api/song/detail returns {songs: [...]} or {data: [{song}]}
    songs = data.get("songs") or data.get("data") or []
    if isinstance(songs, dict):
        songs = songs.get("songs", [])
    result = []
    for s in songs:
        if not isinstance(s, dict):
            continue
        name = s.get("name", "")
        artists = [a.get("name", "") for a in s.get("ar", [])]
        album = s.get("al", {}).get("name", "")
        result.append({"title": name, "artist": " / ".join(artists), "album": album})
    return result


async def parse_netease_url(url: str) -> tuple[str, list[dict]]:
    """
    Parse NetEase playlist by scraping the mobile page (m.163.com).
    This avoids authentication issues that plague the API endpoints.
    """
    pid = extract_netease_id(url)
    if not pid:
        raise ValueError("unable to extract netease playlist id from: " + url)

    # Try the mobile playlist page - public playlists work without login
    mobile_url = f"https://music.163.com/playlist?id={pid}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    async with httpx.AsyncClient(timeout=20.0, headers=headers, follow_redirects=True) as client:
        resp = await client.get(mobile_url)
        resp.raise_for_status()
        text = resp.text

    # Extract playlist name from page title
    import re
    name_match = re.search(r'<title>([^<]+)</title>', text)
    playlist_name = name_match.group(1).replace("- 歌单 - 网易云音乐", "").strip() if name_match else "NetEase Playlist"

    songs = []

    # Try window.__NUXT__ first
    nuxt_match = re.search(r'window\.__NUXT__\s*=\s*(\{.*?\});', text, re.DOTALL)
    if nuxt_match:
        try:
            import json as _json
            nuxt_data = _json.loads(nuxt_match.group(1))
            tracks = nuxt_data.get("state", {}).get("playlist", {}).get("tracks", [])
            for t in tracks:
                artists = [a.get("name", "") for a in t.get("ar", [])]
                songs.append({
                    "title": t.get("name", ""),
                    "artist": " / ".join(artists),
                    "album": t.get("al", {}).get("name", ""),
                })
        except Exception as e:
            logger.warning("[playlist] nuxt parse failed: %s", e)

    # Fallback: try window.__INITIAL_STATE__
    if not songs:
        state_match = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});', text, re.DOTALL)
        if state_match:
            try:
                import json as _json
                state = _json.loads(state_match.group(1))
                tracks = state.get("playlistDetail", {}).get("tracks", [])
                for t in tracks:
                    artists_list = t.get("artists", [])
                    artist_names = [a.get("name", "") for a in artists_list]
                    songs.append({
                        "title": t.get("name", ""),
                        "artist": " / ".join(filter(None, artist_names)),
                        "album": t.get("albumName", ""),
                    })
            except Exception as e:
                logger.warning("[playlist] initial state parse failed: %s", e)

    if not songs:
        raise ValueError("failed to extract songs from netease mobile page (public playlist required)")

    logger.info("[playlist] netease mobile \'%s\': %d songs", playlist_name, len(songs))
    return playlist_name, songs

# ── QQ Music ────────────────────────────────────────────────────────────────

QQ_API = "https://u6.y.qq.com/cgi-bin/musics.fcg"


def _qq_encrypt(param: str) -> str:
    md5_hex = hashlib.md5(param.encode()).hexdigest().upper()
    c = [212, 45, 80, 68, 195, 163, 163, 203, 157, 220, 254, 91, 204, 79, 104, 6]

    def ki(n: str) -> int:
        h = "0123456789ABCDEF"
        return h.index(n) if n in h else 0

    def sel(idx_list):
        return "".join(md5_hex[i] for i in idx_list)

    t1 = sel([21, 4, 9, 26, 16, 20, 27, 30])
    t3 = sel([18, 11, 3, 2, 1, 7, 6, 25])

    ls2 = []
    for i in range(16):
        x1 = ki(md5_hex[i * 2])
        x2 = ki(md5_hex[i * 2 + 1])
        x3 = (x1 * 16 ^ x2) ^ c[i]
        ls2.append(x3)

    t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    ls3 = []
    for i in range(6):
        if i == 5:
            ls3.append(t[ls2[-1] >> 2])
            ls3.append(t[(ls2[-1] & 3) << 4])
        else:
            x4 = ls2[i * 3] >> 2
            x5 = (ls2[i * 3 + 1] >> 4) ^ ((ls2[i * 3] & 3) << 4)
            x6 = (ls2[i * 3 + 2] >> 6) ^ ((ls2[i * 3 + 1] & 15) << 2)
            x7 = 63 & ls2[i * 3 + 2]
            ls3.append(t[x4] + t[x5] + t[x6] + t[x7])

    t2 = re.sub(r"[\/+]", "", "".join(ls3))
    return "zzb" + t1 + t2.lower() + t3.lower()


def extract_qq_id(url: str) -> int | None:
    patterns = [r"playlist/(\d+)", r"[?&]id=(\d+)", r"/(\d+)(?:/|$)"]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return int(m.group(1))
    return None


async def fetch_qq_playlist(playlist_id: int) -> dict:
    param = json.dumps(
        {
            "req_0": {
                "module": "music.srfDissInfo.aiDissInfo",
                "method": "uniform_get_Dissinfo",
                "param": {
                    "disstid": playlist_id,
                    "enc_host_uin": "",
                    "tag": 1,
                    "userinfo": 1,
                    "song_begin": 0,
                    "song_num": 100,
                },
            },
            "comm": {"g_tk": 5381, "uin": 0, "format": "json", "platform": "h5"},
        },
        separators=(",", ":"),
    )
    sign = _qq_encrypt(param)
    url = QQ_API + "?sign=" + sign + "&_=" + str(int(time.time() * 1000))
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            url,
            content=param.encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        resp.raise_for_status()
        return resp.json()


def parse_qq_songs(data: dict) -> tuple[str, list[dict]]:
    try:
        songlist = data["req_0"]["data"]["songlist"]
        name = data["req_0"]["data"]["dirinfo"]["title"]
    except (KeyError, TypeError):
        return "qq playlist", []
    songs = []
    for s in songlist:
        title = s.get("name", "")
        artists = [ar.get("name", "") for ar in s.get("singer", [])]
        songs.append({"title": title, "artist": " / ".join(artists), "album": ""})
    return name, songs


async def parse_qq_url(url: str) -> tuple[str, list[dict]]:
    pid = extract_qq_id(url)
    if not pid:
        raise ValueError("unable to extract qq playlist id from: " + url)
    data = await fetch_qq_playlist(pid)
    name, songs = parse_qq_songs(data)
    logger.info("[playlist] qq '%s': %d songs", name, len(songs))
    return name, songs


# ── Douyin/Qishui ─────────────────────────────────────────────────────────

QISHUI_RE = re.compile(r"https?://qishui\.douyin\.com/s/[a-zA-Z0-9]+")


async def parse_qishui_url(url: str) -> tuple[str, list[dict]]:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    soup = BeautifulSoup(text, "html.parser")

    name_el = soup.select_one(
        "#root > div > div > div > div > div:nth-child(1) > "
        "div:nth-child(3) > h1 > p"
    )
    author_el = soup.select_one(
        "#root > div > div > div > div > div:nth-child(1) > "
        "div:nth-child(3) > div > div > div:nth-child(2) > p"
    )
    name = "qishui playlist"
    if name_el:
        author = author_el.text.strip() if author_el else ""
        name = name_el.text.strip() + "-" + author

    songs = []
    for item in soup.select(
        "#root > div > div > div > div > div:nth-child(2) > "
        "div > div > div > div > div"
    ):
        title_el = item.select_one("div:nth-child(2) > div:nth-child(1) > p")
        artist_el = item.select_one("div:nth-child(2) > div:nth-child(2) > p")
        if title_el:
            title = title_el.text.strip()
            artist = ""
            if artist_el:
                artist = artist_el.text.strip().split("•")[0].strip()
            if title:
                songs.append({"title": title, "artist": artist, "album": ""})

    logger.info("[playlist] qishui '%s': %d songs", name, len(songs))
    return name, songs


# ── Router ───────────────────────────────────────────────────────────────────

URL_RE = re.compile(r"https?://[^\s]+")


async def parse_playlist_url(url: str) -> tuple[str, str, list[dict]]:
    """
    Parse any supported playlist URL.
    Returns (playlist_name, platform, songs)
    platform: 'netease' | 'qq' | 'qishui'
    """
    urls = URL_RE.findall(url)
    if not urls:
        raise ValueError("unrecognized url format: " + url)
    clean_url = urls[0]

    if "163" in clean_url or "netease" in clean_url or "music.163.com" in clean_url:
        name, songs = await parse_netease_url(clean_url)
        return name, "netease", songs
    elif "qq.com" in clean_url or "y.qq.com" in clean_url:
        name, songs = await parse_qq_url(clean_url)
        return name, "qq", songs
    elif "qishui" in clean_url or "douyin.com" in clean_url:
        name, songs = await parse_qishui_url(clean_url)
        return name, "qishui", songs
    else:
        raise ValueError(
            "unsupported platform url: " + clean_url
            + " | supported: netease music, qq music, qishui/douyin music"
        )
