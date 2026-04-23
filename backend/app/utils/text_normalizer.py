"""Text normalization utilities."""

import re


def normalize_title(title: str) -> str:
    """Normalize track title for dedup matching."""
    t = title.lower().strip()
    t = re.sub(r"\s+", " ", t)
    # Remove remaster/live/edit/version markers
    for suffix in [
        r"\s*[\(\[].*remaster.*[\)\]]", r"\s*[\(\[].*live.*[\)\]]",
        r"\s*[\(\[].*edit.*[\)\]]", r"\s*[\(\[].*version.*[\)\]]",
        r"\s*[\(\[].*explicit.*[\)\]]", r"\s*[\(\[].*deluxe.*[\)\]]",
    ]:
        t = re.sub(suffix, "", t, flags=re.IGNORECASE)
    # Remove feat / ft variations
    t = re.sub(r"\s+(feat\.?|ft\.?|featuring)\s+.*$", "", t, flags=re.IGNORECASE)
    # Normalize brackets
    t = t.replace("（", "(").replace("）", ")").replace("【", "[").replace("】", "]")
    return t.strip()


def normalize_artist(artist: str) -> str:
    """Normalize artist name for dedup matching."""
    a = artist.lower().strip()
    a = re.sub(r"\s+(feat\.?|ft\.?|with|&|and)\s+", " ", a, flags=re.IGNORECASE)
    a = re.sub(r"\s+", " ", a)
    return a.strip()


def dedup_key(title: str, artist: str) -> str:
    """Generate a deduplication key from title + artist."""
    return f"{normalize_title(title)}|{normalize_artist(artist)}"

# ── Traditional → Simplified (Taiwan → Mainland) ─────────────────────────
# Covers common Taiwan-specific terms + individual characters
_TW_TO_SIMPLIFIED = {
    # Common Taiwan-specific terms
    "網站": "网站", "軟體": "软件", "硬碟": "硬盘", "記憶體": "内存",
    "作業系統": "操作系统", "工程師": "工程师", "資料": "数据",
    "資訊": "资讯", "使用者": "用户", "密碼": "密码",
    "音樂": "音乐", "歌曲": "歌曲", "專輯": "专辑", "藝術家": "艺术家",
    "播放": "播放", "歌單": "歌单", "相似的曲目": "相似曲目",
    # Characters
    "開": "开", "始": "始", "懂": "懂", "了": "了",
    "孫": "孙", "燕": "燕", "姿": "姿",
    "會": "会", "發": "发", "現": "现", "時": "时",
    "說": "说", "對": "对", "於": "于", "來": "来",
    "開心": "开心", "電話": "电话", "這個": "这个",
    "為": "为", "說": "说", "們": "们", "過": "过",
    "開": "开", "關": "关", "見": "见",
    "與": "与", "國": "国", "學": "学",
    "樣": "样", "機": "机", "東": "东",
}
_TW_CHARS_PATTERN = re.compile('|'.join(re.escape(k) for k in _TW_TO_SIMPLIFIED.keys()))

def to_simplified(text: str) -> str:
    """Convert Taiwan Traditional Chinese to Simplified Chinese."""
    return _TW_CHARS_PATTERN.sub(lambda m: _TW_TO_SIMPLIFIED[m.group(0)], text)

