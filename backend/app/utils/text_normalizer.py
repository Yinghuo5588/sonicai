"""Text normalization utilities — multi-layer text standardization."""

import re
import unicodedata
from typing import Optional


# ── Layer 1: Traditional → Simplified (Taiwan → Mainland CN) ─────────────────

_TW_SIMPLIFIED_MAP: dict[str, str] = {
    # Taiwan-specific terms
    "軟體": "软件", "硬碟": "硬盘", "記憶體": "内存", "作業系統": "操作系统",
    "工程師": "工程师", "資訊": "资讯", "使用者": "用户",
    "音樂": "音乐", "歌曲": "歌曲", "專輯": "专辑", "藝術家": "艺术家",
    "播放": "播放", "歌單": "歌单", "相似的曲目": "相似曲目",
    # Common TW chars
    "開": "开", "始": "始", "懂": "懂", "了": "了",
    "孫": "孙", "燕": "燕", "姿": "姿",
    "會": "会", "發": "发", "現": "现", "時": "时",
    "說": "说", "對": "对", "於": "于", "來": "来",
    "為": "为", "們": "们", "過": "过", "關": "关", "見": "见",
    "與": "与", "國": "国", "學": "学", "樣": "样", "機": "机", "東": "东",
    "這": "这", "個": "个", "電話": "电话",
    "網": "网", "站": "站",
}
_TW_PATTERN = re.compile("|".join(re.escape(k) for k in _TW_SIMPLIFIED_MAP.keys()))


def to_simplified(text: str) -> str:
    """Convert Taiwan Traditional Chinese to Mainland Simplified Chinese."""
    return _TW_PATTERN.sub(lambda m: _TW_SIMPLIFIED_MAP[m.group(0)], text)


# ── Layer 2: Unicode NFKC normalization ─────────────────────────────────────────

def nfkc(text: str) -> str:
    """NFKC normalize: fold fullwidth chars, combining marks, etc."""
    return unicodedata.normalize("NFKC", text)


# ── Layer 3: Fullwidth → halfwidth ────────────────────────────────────────────

_FULLWIDTH_MAP = {
    "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D", "Ｅ": "E", "Ｆ": "F",
    "Ｇ": "G", "Ｈ": "H", "Ｉ": "I", "Ｊ": "J", "Ｋ": "K", "Ｌ": "L",
    "Ｍ": "M", "Ｎ": "N", "Ｏ": "O", "Ｐ": "P", "Ｑ": "Q", "Ｒ": "R",
    "Ｓ": "S", "Ｔ": "T", "Ｕ": "U", "Ｖ": "V", "Ｗ": "W", "Ｘ": "X",
    "Ｙ": "Y", "Ｚ": "Z",
    "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d", "ｅ": "e", "ｆ": "f",
    "ｇ": "g", "ｈ": "h", "ｉ": "i", "ｊ": "j", "ｋ": "k", "ｌ": "l",
    "ｍ": "m", "ｎ": "n", "ｏ": "o", "ｐ": "p", "ｑ": "q", "ｒ": "r",
    "ｓ": "s", "ｔ": "t", "ｕ": "u", "ｖ": "v", "ｗ": "w", "ｘ": "x",
    "ｙ": "y", "ｚ": "z",
    "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
    "５": "5", "６": "6", "٧": "7", "８": "8", "９": "9",
    "（": "(", "）": ")", "【": "[", "】": "]", "－": "-", "—": "-",
    "　": " ", "．": ".", "，": ",", "：": ":", "；": ";",
    "！": "!", "？": "?", "＋": "+", "＝": "=",
}
_FW_PATTERN = re.compile("|".join(re.escape(k) for k in _FULLWIDTH_MAP.keys()))


def fullwidth_to_halfwidth(text: str) -> str:
    return _FW_PATTERN.sub(lambda m: _FULLWIDTH_MAP[m.group(0)], text)


# ── Layer 4: Version / edition suffixes to strip ───────────────────────────────

_VERSION_PATTERNS = [
    re.compile(r"\s*[\(\[].*?(remaster|remastered|live|version|edit|demo|mono|stereo|explicit|deluxe|instrumental|bonus\s*track|现场版|演唱会版|重制版|伴奏).*?[\)\]]", re.IGNORECASE),
    re.compile(r"\s*[-‐‑–—·・]\s*(remaster|live|version|edit|demo)$", re.IGNORECASE),
]
_VERSION_END_PATTERNS = [
    re.compile(r"\s*[\(\[].*?[\)\]]$"),
]
_FEAT_PATTERNS = [
    re.compile(r"\s+(feat\.?|ft\.?|featuring|with)\s+.*$", re.IGNORECASE),
]


def strip_version_suffix(text: str) -> str:
    """Remove edition suffixes like (Live), - Remastered, etc."""
    t = text.strip()
    for p in _VERSION_PATTERNS:
        t = p.sub("", t)
    for p in _VERSION_END_PATTERNS:
        t = p.sub("", t)
    return t.strip()


def strip_feat(text: str) -> str:
    """Remove feat./ft. trailing artists."""
    t = text.strip()
    for p in _FEAT_PATTERNS:
        t = p.sub("", t)
    return t.strip()


# ── Layer 5: Punctuation & whitespace normalization ───────────────────────────

_MULTI_SPACE = re.compile(r"\s+")
_PUNCTUATION = [
    ("（", "("), ("）", ")"), ("【", "["), ("】", "]"),
    ("——", "-"), ("–", "-"), ("—", "-"),
    ("''", "\""), ('""', "\""), ("‘", "'"), ("’", "'"),
]


def normalize_punctuation(text: str) -> str:
    for old, new in _PUNCTUATION:
        text = text.replace(old, new)
    return text


def normalize_whitespace(text: str) -> str:
    return _MULTI_SPACE.sub(" ", text.strip())


# ── Core normalization pipeline ───────────────────────────────────────────────

def normalize_base(text: str) -> str:
    """Layer 2-5: NFKC → fullwidth → lower → strip feat → strip version → punct → whitespace."""
    if not text:
        return ""
    t = nfkc(text)
    t = fullwidth_to_halfwidth(t)
    t = t.lower()
    t = strip_feat(t)
    t = strip_version_suffix(t)
    t = normalize_punctuation(t)
    t = normalize_whitespace(t)
    return t


# ── Public API ─────────────────────────────────────────────────────────────────

def normalize_title(title: str) -> str:
    """Normalize track title: NFKC + fullwidth + lower + strip version + feat."""
    return normalize_base(title)


def normalize_artist(artist: str) -> str:
    """Normalize artist name: NFKC + fullwidth + lower + strip feat."""
    return normalize_base(artist)


def dedup_key(title: str, artist: str) -> str:
    """Generate deduplication key from title + artist."""
    return f"{normalize_title(title)}|{normalize_artist(artist)}"


# ── Multi-version query generation ──────────────────────────────────────────

def make_search_queries(title: str, artist: str) -> list[dict]:
    """
    Generate prioritized search queries with 8 strategies.
    Returns list of {query, label} dicts.
    """
    # Core versions
    title_norm = normalize_title(title)
    artist_norm = normalize_artist(artist)
    title_s2 = to_simplified(title_norm)
    artist_s2 = to_simplified(artist_norm)
    title_core = strip_version_suffix(strip_feat(title_norm))
    artist_core = strip_version_suffix(strip_feat(artist_norm))

    queries = []

    def add(q, label):
        if q:
            queries.append({"query": q, "label": label})

    # Priority 1: raw core title + raw core artist
    if title_core and artist_core:
        add(f"{title_core} {artist_core}", "raw_title_raw_artist")
    # Priority 2: simplified core title + simplified core artist
    if title_s2 and artist_s2:
        add(f"{title_s2} {artist_s2}", "s2_title_s2_artist")
    # Priority 3: raw title + simplified artist
    if title_core and artist_s2:
        add(f"{title_core} {artist_s2}", "raw_title_s2_artist")
    # Priority 4: simplified title + raw artist
    if title_s2 and artist_core:
        add(f"{title_s2} {artist_core}", "s2_title_raw_artist")
    # Priority 5: raw title only
    if title_core:
        add(title_core, "raw_title_only")
    # Priority 6: simplified title only
    if title_s2:
        add(title_s2, "s2_title_only")
    # Priority 7: reversed (artist + title)
    if artist_core and title_core:
        add(f"{artist_core} {title_core}", "raw_artist_raw_title")
    if artist_s2 and title_s2:
        add(f"{artist_s2} {title_s2}", "s2_artist_s2_title")

    return queries


def score_candidate(lastfm_title: str, lastfm_artist: str, nav_title: str, nav_artist: str) -> dict:
    """
    Score a Navidrome result against a Last.fm track.
    Returns dict with score (0~1), title_score, artist_score.
    Uses both raw and simplified comparison, takes max.
    """
    from rapidfuzz import fuzz

    # Build normalized versions of Last.fm
    lf_title_norm = normalize_title(lastfm_title)
    lf_artist_norm = normalize_artist(lastfm_artist)
    lf_title_s2 = to_simplified(lf_title_norm)
    lf_artist_s2 = to_simplified(lf_artist_norm)

    # Normalize Navidrome result
    nav_title_norm = normalize_title(nav_title)
    nav_artist_norm = normalize_artist(nav_artist)
    nav_title_s2 = to_simplified(nav_title_norm)
    nav_artist_s2 = to_simplified(nav_artist_norm)

    # Title: compare raw vs raw, simplified vs simplified, take max
    t_score_raw = fuzz.token_sort_ratio(lf_title_norm, nav_title_norm) / 100
    t_score_s2 = fuzz.token_sort_ratio(lf_title_s2, nav_title_s2) / 100
    title_score = max(t_score_raw, t_score_s2)

    # Artist: compare raw vs raw, simplified vs simplified, take max
    a_score_raw = fuzz.token_set_ratio(lf_artist_norm, nav_artist_norm) / 100
    a_score_s2 = fuzz.token_set_ratio(lf_artist_s2, nav_artist_s2) / 100
    artist_score = max(a_score_raw, a_score_s2)

    # Combined: title 65% + artist 35%
    combined = title_score * 0.65 + artist_score * 0.35

    return {
        "score": round(combined, 4),
        "title_score": round(title_score, 4),
        "artist_score": round(artist_score, 4),
    }