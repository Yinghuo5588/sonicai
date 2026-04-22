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