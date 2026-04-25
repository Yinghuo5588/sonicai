"""Text normalization utilities — multi-layer text standardization."""

import re
import unicodedata


# ── Traditional → Simplified (OpenCC) ─────────────────────────────────────────────

_oc = None
_opencc_failed = False

def _get_opencc():
    global _oc, _opencc_failed
    if _oc is None and not _opencc_failed:
        try:
            from opencc import OpenCC
            _oc = OpenCC("t2s")
        except Exception:
            _opencc_failed = True
    return _oc


def to_simplified(text: str) -> str:
    """Convert Traditional Chinese to Simplified Chinese via OpenCC t2s."""
    oc = _get_opencc()
    if oc is None:
        return text  # fallback: return as-is
    return oc.convert(text)


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
    re.compile(r"\s*[\(\[].*?(remaster|remastered|live|version|edit|demo|mono|stereo|explicit|deluxe|instrumental|bonus\s*track|现场版|演唱会版|重制版|伴奏|特别版|限定版).*?[\)\]]", re.IGNORECASE),
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
_ARTIST_SEP = re.compile(r"\s*[/&,;；和]\s*")
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
    """Base normalization without Traditional→Simplified (for query diversity)."""
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


def normalize_for_compare(text: str) -> str:
    """Full normalization including Traditional→Simplified (for matching/comparison)."""
    if not text:
        return ""
    t = nfkc(text)
    t = to_simplified(t)
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
    if not artist:
        return ""
    t = nfkc(artist)
    t = to_simplified(t)
    t = fullwidth_to_halfwidth(t)
    t = t.lower()
    t = strip_feat(t)
    t = strip_version_suffix(t)
    t = normalize_punctuation(t)
    t = _ARTIST_SEP.sub(" ", t)  # normalize multi-artist separators
    t = normalize_whitespace(t)
    return t


def dedup_key(title: str, artist: str) -> str:
    # Use normalize_for_compare (with 繁简) so that
    # 《開始懂了》/《开始懂了》 generates the same dedup_key
    return f"{normalize_for_compare(title)}|{normalize_for_compare(artist)}"


# ── Multi-query generation + scoring ─────────────────────────────────────────

def make_search_queries(title: str, artist: str) -> list[dict]:
    title_raw = normalize_base(title)
    artist_raw = normalize_base(artist)
    title_s2 = to_simplified(title_raw) if title_raw else ""
    artist_s2 = to_simplified(artist_raw) if artist_raw else ""
    title_core = strip_version_suffix(strip_feat(title_raw))
    artist_core = strip_version_suffix(strip_feat(artist_raw))
    artist_core_s2 = to_simplified(artist_core) if artist_core else ""

    queries = []
    seen = set()

    def add(q, label):
        if q and q not in seen:
            seen.add(q)
            queries.append({"query": q, "label": label})

    if title_core and artist_core:
        add(f"{title_core} {artist_core}", "raw_title_artist")
    if title_s2 and artist_s2 and (title_s2 != title_core or artist_s2 != artist_core):
        add(f"{title_s2} {artist_s2}", "s2_title_artist")
    if title_core and artist_s2 and artist_s2 != artist_core:
        add(f"{title_core} {artist_s2}", "raw_title_s2_artist")
    if title_s2 and artist_core and title_s2 != title_core:
        add(f"{title_s2} {artist_core}", "s2_title_raw_artist")
    if title_core:
        add(title_core, "title_only")
    if title_s2 and title_s2 != title_core:
        add(title_s2, "s2_title_only")
    if artist_core and title_core:
        add(f"{artist_core} {title_core}", "artist_reversed")
    if artist_core_s2 and title_s2 and (artist_core_s2 != artist_core or title_s2 != title_core):
        add(f"{artist_core_s2} {title_s2}", "s2_artist_reversed")

    return queries


def score_candidate(lastfm_title: str, lastfm_artist: str, nav_title: str, nav_artist: str) -> dict:
    from rapidfuzz import fuzz

    lf_title_raw = normalize_base(lastfm_title)
    lf_artist_raw = normalize_base(lastfm_artist)
    lf_title_s2 = to_simplified(lf_title_raw)
    lf_artist_s2 = to_simplified(lf_artist_raw)

    nav_title_raw = normalize_base(nav_title)
    nav_artist_raw = normalize_base(nav_artist)
    nav_title_s2 = to_simplified(nav_title_raw)
    nav_artist_s2 = to_simplified(nav_artist_raw)

    # For short Chinese titles, try multiple ratios and pick the best meaningful one
    def title_score(la, lb):
        r1 = fuzz.ratio(la, lb) / 100.0
        r2 = fuzz.token_sort_ratio(la, lb) / 100.0
        r3 = fuzz.partial_ratio(la, lb) / 100.0
        # Cap partial_ratio for short titles to avoid false positives from substring matching
        if len(la) <= 6 or len(lb) <= 6:
            return max(r1, r2, min(r3, 0.92))
        return max(r1, r2)

    t_s_raw = title_score(lf_title_raw, nav_title_raw)
    t_s_s2 = title_score(lf_title_s2, nav_title_s2)
    title_score_val = max(t_s_raw, t_s_s2)

    a_s_raw = fuzz.token_set_ratio(lf_artist_raw, nav_artist_raw) / 100.0
    a_s_s2 = fuzz.token_set_ratio(lf_artist_s2, nav_artist_s2) / 100.0
    artist_score_val = max(a_s_raw, a_s_s2)

    combined = title_score_val * 0.65 + artist_score_val * 0.35

    return {
        "score": round(combined, 4),
        "title_score": round(title_score_val, 4),
        "artist_score": round(artist_score_val, 4),
    }