from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean,
    ForeignKey, Text, JSON, Numeric, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="sessions")


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)
    timezone = Column(String(50), default="Asia/Shanghai")

    # Last.fm
    lastfm_api_key = Column(String(255), nullable=True)
    lastfm_username = Column(String(255), nullable=True)

    # Navidrome
    navidrome_url = Column(String(500), nullable=True)
    navidrome_username = Column(String(255), nullable=True)
    navidrome_password_encrypted = Column(String(255), nullable=True)

    # Webhook
    webhook_url = Column(String(500), nullable=True)
    webhook_headers_json = Column(Text, nullable=True)  # JSON string
    webhook_timeout_seconds = Column(Integer, default=10)
    webhook_retry_count = Column(Integer, default=3)

    # Playlist
    playlist_keep_days = Column(Integer, default=3)
    playlist_api_url = Column(String(500), nullable=True)  # e.g. https://sss.unmeta.cn/songlist

    # Recommendation
    library_mode_default = Column(String(20), default="allow_missing")  # library_only | allow_missing
    duplicate_avoid_days = Column(Integer, default=14)
    top_track_seed_limit = Column(Integer, default=30)
    top_artist_seed_limit = Column(Integer, default=30)
    similar_track_limit = Column(Integer, default=30)
    similar_artist_limit = Column(Integer, default=30)
    artist_top_track_limit = Column(Integer, default=2)
    similar_playlist_size = Column(Integer, default=30)
    artist_playlist_size = Column(Integer, default=30)
    recommendation_balance = Column(Integer, default=55)

    # Seed strategy
    seed_source_mode = Column(String(30), default="recent_plus_top")  # recent_only | top_only | recent_plus_top
    recent_tracks_limit = Column(Integer, default=100)
    top_period = Column(String(20), default="1month")  # 7day | 1month | 3month | 6month | 12month | overall
    recent_top_mix_ratio = Column(Integer, default=70)  # 0-100, how much recent vs top

    # Matching
    match_threshold = Column(Numeric(4, 3), default=0.75)  # Pool sizing
    candidate_pool_multiplier_min = Column(Numeric(4, 1), default=2.0)
    candidate_pool_multiplier_max = Column(Numeric(4, 1), default=10.0)
    search_concurrency = Column(Integer, default=5)  # Navidrome concurrent search limit (1-20)

    # Task concurrency
    max_concurrent_tasks = Column(Integer, default=2)  # Global background task limit (1-5)

    # Scheduler - Last.fm recommendation
    cron_enabled = Column(Boolean, default=False)
    cron_expression = Column(String(100), nullable=True)
    recommendation_cron_run_type = Column(String(30), default="full")  # full | similar_tracks | similar_artists

    # Hotboard scheduled sync
    hotboard_cron_enabled = Column(Boolean, default=False)
    hotboard_cron_expression = Column(String(100), nullable=True)
    hotboard_limit = Column(Integer, default=50)
    hotboard_match_threshold = Column(Numeric(4, 3), default=0.75)
    hotboard_playlist_name = Column(String(255), nullable=True)
    hotboard_overwrite = Column(Boolean, default=True)

    # Playlist URL scheduled sync
    playlist_sync_cron_enabled = Column(Boolean, default=False)
    playlist_sync_cron_expression = Column(String(100), nullable=True)
    playlist_sync_url = Column(String(1000), nullable=True)
    playlist_sync_threshold = Column(Numeric(4, 3), default=0.75)
    playlist_sync_name = Column(String(255), nullable=True)
    playlist_sync_overwrite = Column(Boolean, default=False)
    playlist_sync_last_hash = Column(String(64), nullable=True)

    # Song cache
    song_cache_enabled = Column(Boolean, default=True)
    song_cache_auto_refresh_enabled = Column(Boolean, default=True)
    song_cache_refresh_cron = Column(String(100), default="0 4 * * *")

    # Match debug
    match_debug_enabled = Column(Boolean, default=False)

    # Matching mode
    match_mode = Column(String(20), default="full")  # full | local | api

    # Missed track retry
    missed_track_retry_enabled = Column(Boolean, default=False)
    missed_track_retry_cron = Column(String(100), default="0 3 * * *")
    missed_track_retry_limit = Column(Integer, default=100)
    missed_track_retry_refresh_library = Column(Boolean, default=True)
    missed_track_retry_mode = Column(String(20), default="local")  # local | api | full

    # History cleanup
    history_cleanup_enabled = Column(Boolean, default=False)
    run_history_keep_days = Column(Integer, default=90)
    webhook_history_keep_days = Column(Integer, default=30)
    keep_failed_history = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RecommendationRun(Base):
    __tablename__ = "recommendation_runs"

    id = Column(Integer, primary_key=True)
    run_type = Column(String(30), nullable=False)  # full | similar_tracks | similar_artists
    trigger_type = Column(String(20), nullable=True)  # manual | scheduled
    status = Column(String(30), default="pending")  # pending|running|success|partial_success|failed
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    config_snapshot_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    playlists = relationship("GeneratedPlaylist", back_populates="run", cascade="all, delete-orphan")
    webhook_batches = relationship("WebhookBatch", back_populates="run", cascade="all, delete-orphan")


class GeneratedPlaylist(Base):
    __tablename__ = "generated_playlists"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("recommendation_runs.id", ondelete="CASCADE"), nullable=False)
    playlist_type = Column(String(30), nullable=False)  # similar_tracks | similar_artists
    playlist_name = Column(String(255), nullable=False)
    playlist_date = Column(String(20), nullable=False)
    navidrome_playlist_id = Column(String(100), nullable=True)
    status = Column(String(30), default="pending")
    error_message = Column(Text, nullable=True)
    total_candidates = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    missing_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    run = relationship("RecommendationRun", back_populates="playlists")
    items = relationship("RecommendationItem", back_populates="playlist", cascade="all, delete-orphan")


class RecommendationItem(Base):
    __tablename__ = "recommendation_items"

    id = Column(Integer, primary_key=True)
    generated_playlist_id = Column(Integer, ForeignKey("generated_playlists.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    artist = Column(String(500), nullable=False)
    album = Column(String(500), nullable=True)
    score = Column(Numeric(10, 4), nullable=True)
    source_type = Column(String(30), nullable=False)  # track_similarity | artist_similarity
    source_seed_name = Column(String(500), nullable=True)
    source_seed_artist = Column(String(500), nullable=True)
    dedup_key = Column(String(500), nullable=True, index=True)
    rank_index = Column(Integer, nullable=True)
    raw_payload_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    playlist = relationship("GeneratedPlaylist", back_populates="items")
    navidrome_match = relationship("NavidromeMatch", back_populates="item", uselist=False, cascade="all, delete-orphan")


class NavidromeMatch(Base):
    __tablename__ = "navidrome_matches"

    id = Column(Integer, primary_key=True)
    recommendation_item_id = Column(Integer, ForeignKey("recommendation_items.id", ondelete="CASCADE"), nullable=False, unique=True)
    matched = Column(Boolean, default=False)
    search_query = Column(String(500), nullable=True)
    selected_song_id = Column(String(100), nullable=True)
    selected_title = Column(String(500), nullable=True)
    selected_artist = Column(String(500), nullable=True)
    selected_album = Column(String(500), nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True)
    raw_response_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    item = relationship("RecommendationItem", back_populates="navidrome_match")


class WebhookBatch(Base):
    __tablename__ = "webhook_batches"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("recommendation_runs.id", ondelete="CASCADE"), nullable=False)
    playlist_type = Column(String(30), nullable=False)
    payload_json = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending|success|failed|retrying
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retry_count = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    run = relationship("RecommendationRun", back_populates="webhook_batches")
    items = relationship("WebhookBatchItem", back_populates="batch", cascade="all, delete-orphan")


class WebhookBatchItem(Base):
    __tablename__ = "webhook_batch_items"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("webhook_batches.id", ondelete="CASCADE"), nullable=False)
    track = Column(String(500), nullable=True)
    artist = Column(String(500), nullable=True)
    album = Column(String(500), nullable=True)
    text = Column(String(1000), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    batch = relationship("WebhookBatch", back_populates="items")


class LastfmCache(Base):
    __tablename__ = "lastfm_cache"

    id = Column(Integer, primary_key=True)
    cache_key = Column(String(255), unique=True, nullable=False, index=True)
    cache_type = Column(String(50), nullable=False)
    payload_json = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ── Song Library (Phase 2) ─────────────────────────────────────────────────────

class SongLibrary(Base):
    __tablename__ = "song_library"

    id = Column(Integer, primary_key=True)
    navidrome_id = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    artist = Column(String(500), nullable=True)
    album = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)
    title_norm = Column(String(500), nullable=True, index=True)
    title_core = Column(String(500), nullable=True, index=True)
    artist_norm = Column(String(500), nullable=True, index=True)
    source = Column(String(30), default="sync")  # sync | passive | manual
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    title_aliases = relationship(
        "SongTitleAlias",
        back_populates="song",
        cascade="all, delete-orphan",
    )
    artist_aliases = relationship(
        "SongArtistAlias",
        back_populates="song",
        cascade="all, delete-orphan",
    )


class SongTitleAlias(Base):
    __tablename__ = "song_title_alias"

    id = Column(Integer, primary_key=True)
    song_id = Column(Integer, ForeignKey("song_library.id", ondelete="CASCADE"), nullable=False)
    alias = Column(String(500), nullable=False, index=True)
    alias_type = Column(String(30), default="auto")  # auto | core | manual
    created_at = Column(DateTime, server_default=func.now())

    song = relationship("SongLibrary", back_populates="title_aliases")


class SongArtistAlias(Base):
    __tablename__ = "song_artist_alias"

    id = Column(Integer, primary_key=True)
    song_id = Column(Integer, ForeignKey("song_library.id", ondelete="CASCADE"), nullable=False)
    alias = Column(String(500), nullable=False, index=True)
    alias_type = Column(String(30), default="auto")
    created_at = Column(DateTime, server_default=func.now())

    song = relationship("SongLibrary", back_populates="artist_aliases")


class MatchCache(Base):
    __tablename__ = "match_cache"

    id = Column(Integer, primary_key=True)
    input_title = Column(String(500), nullable=False)
    input_artist = Column(String(500), nullable=True)
    input_title_norm = Column(String(500), nullable=True, index=True)
    input_artist_norm = Column(String(500), nullable=True, index=True)
    song_id = Column(Integer, ForeignKey("song_library.id", ondelete="SET NULL"), nullable=True)
    navidrome_id = Column(String(100), nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True)
    source = Column(String(30), default="auto")  # memory | db | subsonic | manual
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ManualMatch(Base):
    __tablename__ = "manual_match"

    id = Column(Integer, primary_key=True)
    input_title = Column(String(500), nullable=False)
    input_artist = Column(String(500), nullable=True)
    input_title_norm = Column(String(500), nullable=True, index=True)
    input_artist_norm = Column(String(500), nullable=True, index=True)
    song_id = Column(Integer, ForeignKey("song_library.id", ondelete="SET NULL"), nullable=True)
    navidrome_id = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class MatchLog(Base):
    __tablename__ = "match_log"

    id = Column(Integer, primary_key=True)
    input_title = Column(String(500), nullable=False)
    input_artist = Column(String(500), nullable=True)
    matched = Column(Boolean, default=False)
    navidrome_id = Column(String(100), nullable=True)
    selected_title = Column(String(500), nullable=True)
    selected_artist = Column(String(500), nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True)
    source = Column(String(30), nullable=True)  # manual | cache | memory | db | subsonic | miss
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class MissedTrack(Base):
    """Task pool for tracks that were not matched locally.

    Unlike match_log which is an append-only audit log, this table
    acts as a recovery queue: the same track updates existing rows
    (seen_count increments) rather than creating duplicates.
    """
    __tablename__ = "missed_tracks"

    id = Column(Integer, primary_key=True)

    title = Column(String(500), nullable=False)
    artist = Column(String(500), nullable=True)

    title_norm = Column(String(500), nullable=False, index=True)
    artist_norm = Column(String(500), nullable=False, default="", index=True)

    match_threshold = Column(Numeric(4, 3), default=0.75)

    # pending: 待重试  matched: 已补库并匹配成功
    # failed: 达到最大重试次数仍失败  ignored: 用户手动忽略
    status = Column(String(20), default="pending", index=True)

    source = Column(String(50), nullable=True)
    last_error = Column(Text, nullable=True)

    seen_count = Column(Integer, default=1)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)

    last_seen_at = Column(DateTime, nullable=True)
    last_retry_at = Column(DateTime, nullable=True)
    matched_at = Column(DateTime, nullable=True)
    matched_navidrome_id = Column(String(100), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("title_norm", "artist_norm", name="uq_missed_tracks_input_norm"),
    )