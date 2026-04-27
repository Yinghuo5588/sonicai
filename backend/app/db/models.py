from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean,
    ForeignKey, Text, JSON, Numeric
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

    # Scheduler
    cron_enabled = Column(Boolean, default=False)
    cron_expression = Column(String(100), nullable=True)

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