// API response type definitions

export interface RunProgress {
  total_candidates: number
  matched: number
  missing: number
  percent: number
}

export interface Run {
  id: number
  run_type: string
  trigger_type: string | null
  status: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  created_at: string | null
  progress?: RunProgress
}

export interface Playlist {
  id: number
  run_id?: number
  playlist_name: string
  playlist_type: string
  status: string
  matched_count: number
  missing_count: number
  total_candidates: number
  navidrome_playlist_id: string | null
  created_at: string | null
}

export interface PlaylistItem {
  id: number
  title: string
  artist: string
  album: string | null
  score: number | null
  source_type: string
  source_seed_name: string | null
  source_seed_artist: string | null
  rank_index: number | null
  navidrome_id: string | null
  navidrome_title: string | null
  navidrome_artist: string | null
  matched: boolean
  confidence_score: number | null
  search_query: string | null
}

export interface DashboardSummary {
  total_runs: number
  last_run: Run | null
  total_playlists: number
  total_matched: number
  total_missing: number
  webhook_success_count: number
  webhook_failed_count: number
}

export interface WebhookBatch {
  id: number
  run_id: number
  playlist_type: string
  status: string
  retry_count: number
  max_retry_count: number
  response_code: number | null
  created_at: string | null
}

export interface Settings {
  timezone: string
  lastfm_api_key: string | null
  lastfm_username: string | null
  navidrome_url: string | null
  navidrome_username: string | null
  webhook_url: string | null
  webhook_headers_json: string | null
  webhook_timeout_seconds: number
  webhook_retry_count: number
  playlist_keep_days: number
  playlist_api_url: string | null
  library_mode_default: string
  duplicate_avoid_days: number
  top_track_seed_limit: number
  top_artist_seed_limit: number
  similar_track_limit: number
  similar_artist_limit: number
  artist_top_track_limit: number
  similar_playlist_size: number
  artist_playlist_size: number
  recommendation_balance: number
  seed_source_mode: string | null
  recent_tracks_limit: number | null
  top_period: string | null
  recent_top_mix_ratio: number | null
  match_threshold: number | null
  candidate_pool_multiplier_min: number | null
  candidate_pool_multiplier_max: number | null
  search_concurrency: number | null
  cron_enabled: boolean
  cron_expression: string | null
  // Hotboard scheduled sync
  hotboard_cron_enabled: boolean
  hotboard_cron_expression: string | null
  hotboard_limit: number
  hotboard_match_threshold: number | null
  hotboard_playlist_name: string | null
  hotboard_overwrite: boolean
  // Playlist URL scheduled sync
  playlist_sync_cron_enabled: boolean
  playlist_sync_cron_expression: string | null
  playlist_sync_url: string | null
  playlist_sync_threshold: number | null
  playlist_sync_name: string | null
  playlist_sync_overwrite: boolean
  // Song cache
  song_cache_enabled: boolean | null
  song_cache_auto_refresh_enabled: boolean | null
  song_cache_refresh_cron: string | null
  // Match debug
  match_debug_enabled: boolean | null
}
// ── Library / Song Cache ────────────────────────────────────────────────────────

export interface SongCacheStatus {
  enabled: boolean
  ready: boolean
  refreshing: boolean
  total_songs: number
  last_full_refresh: string | null
  last_error: string | null
  hits: number
  misses: number
  fallbacks: number
  hit_rate: number
  refresh_count: number
}

export interface LibraryStatus {
  total_songs: number
  cache: SongCacheStatus
}

export interface LibrarySong {
  id: number
  navidrome_id: string
  title: string
  artist: string | null
  album: string | null
  duration: number | null
  source: string | null
  last_seen_at: string | null
}

export interface LibrarySongsResponse {
  total: number
  items: LibrarySong[]
}

export interface MatchLogItem {
  id: number
  input_title: string
  input_artist: string | null
  matched: boolean
  navidrome_id: string | null
  selected_title: string | null
  selected_artist: string | null
  confidence_score: number | null
  source: string | null
  raw_json?: string | null
  created_at: string | null
}

export interface MatchLogsResponse {
  total: number
  items: MatchLogItem[]
}

export interface ManualMatchItem {
  id: number
  input_title: string
  input_artist: string | null
  navidrome_id: string | null
  note: string | null
  created_at: string | null
}

export interface ManualMatchesResponse {
  total: number
  items: ManualMatchItem[]
}

export interface CreateManualMatchPayload {
  input_title: string
  input_artist?: string
  navidrome_id: string
  note?: string
}
