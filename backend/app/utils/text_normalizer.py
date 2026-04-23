"""Text normalization utilities — multi-layer text standardization."""

import re
import unicodedata


# ── Traditional → Simplified (OpenCC preferred, fallback dict) ─────────────────

_TW_FALLBACK_MAP = {
    "開": "开", "會": "会", "說": "说", "對": "对", "於": "于",
    "來": "来", "為": "为", "們": "们", "過": "过", "關": "关",
    "見": "见", "與": "与", "國": "国", "學": "学", "樣": "样",
    "機": "机", "東": "东", "這": "这", "個": "个", "網": "网",
    "孫": "孙", "電話": "电话", "開始": "开始",
}
_TW_PATTERN = re.compile("|".join(re.escape(k) for k in _TW_FALLBACK_MAP.keys())) if _TW_FALLBACK_MAP else None

_oc = None

def _get_opencc():
    global _oc
    if _oc is None:
        try:
            from opencc import OpenCC
            _oc = OpenCC("t2s")
        except Exception:
            _oc = False
    return _oc


def to_simplified(text: str) -> str:
    """Convert Traditional Chinese (incl. Taiwan variant) to Simplified Chinese."""
    cc = _get_opencc()
    if cc:
        return cc.convert(text)
    if not text:
        return text
    return _TW_PATTERN.sub(lambda m: _TW_FALLBACK_MAP[m.group(0)], text) if _TW_PATTERN else text


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
    "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
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
    t = text.strip()
    for p in _VERSION_PATTERNS:
        t = p.sub("", t)
    for p in _VERSION_END_PATTERNS:
        t = p.sub("", t)
    return t.strip()


def strip_feat(text: str) -> str:
    t = text.strip()
    for p in _FEAT_PATTERNS:
        t = p.sub("", t)
    return t.strip()


# ── Layer 5: Punctuation & whitespace normalization ───────────────────────────

_MULTI_SPACE = re.compile(r"\s+")
_PUNCTUATION = [
    ("（", "("), ("）", ")"), ("【", "["), ("】", "]"),
    ("——", "-"), ("–", "-"), ("—", "-"),
]


def normalize_punctuation(text: str) -> str:
    for old, new in _PUNCTUATION:
        text = text.replace(old, new)
    return text


def normalize_whitespace(text: str) -> str:
    return _MULTI_SPACE.sub(" ", text.strip())


# ── Core normalization pipeline ───────────────────────────────────────────────

def normalize_base(text: str) -> str:
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
    return normalize_base(title)


def normalize_artist(artist: str) -> str:
    return normalize_base(artist)


def dedup_key(title: str, artist: str) -> str:
    return f"{normalize_title(title)}|{normalize_artist(artist)}"


# ── Multi-query generation + scoring ─────────────────────────────────────────

def make_search_queries(title: str, artist: str) -> list[dict]:
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

    if title_core and artist_core:
        add(f"{title_core} {artist_core}", "raw_artist_title")
    if title_s2 and artist_s2:
        add(f"{title_s2} {artist_s2}", "s2_title_s2_artist")
    if title_core and artist_s2:
        add(f"{title_core} {artist_s2}", "raw_title_s2_artist")
    if title_s2 and artist_core:
        add(f"{title_s2} {artist_core}", "s2_title_raw_artist")
    if title_core:
        add(title_core, "raw_title_only")
    if title_s2:
        add(title_s2, "s2_title_only")
    if artist_core and title_core:
        add(f"{artist_core} {title_core}", "raw_artist_reversed")
    if artist_s2 and title_s2:
        add(f"{artist_s2} {title_s2}", "s2_artist_reversed")

    return queries


def score_candidate(lastfm_title: str, lastfm_artist: str, nav_title: str, nav_artist: str) -> dict:
    from rapidfuzz import fuzz

    lf_title_norm = normalize_title(lastfm_title)
    lf_artist_norm = normalize_artist(lastfm_artist)
    lf_title_s2 = to_simplified(lf_title_norm)
    lf_artist_s2 = to_simplified(lf_artist_norm)

    nav_title_norm = normalize_title(nav_title)
    nav_artist_norm = normalize_artist(nav_artist)
    nav_title_s2 = to_simplified(nav_title_norm)
    nav_artist_s2 = to_simplified(nav_artist_norm)

    t_score_raw = fuzz.token_sort_ratio(lf_title_norm, nav_title_norm) / 100
    t_score_s2 = fuzz.token_sort_ratio(lf_title_s2, nav_title_s2) / 100
    title_score = max(t_score_raw, t_score_s2)

    a_score_raw = fuzz.token_set_ratio(lf_artist_norm, nav_artist_norm) / 100
    a_score_s2 = fuzz.token_set_ratio(lf_artist_s2, nav_artist_s2) / 100
    artist_score = max(a_score_raw, a_score_s2)

    combined = title_score * 0.65 + artist_score * 0.35

    return {
        "score": round(combined, 4),
        "title_score": round(title_score, 4),
        "artist_score": round(artist_score, 4),
    }