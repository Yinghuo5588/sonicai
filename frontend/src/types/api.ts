// API response type definitions

export interface Run {
  id: number
  run_type: string
  trigger_type: string | null
  status: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
  created_at: string | null
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
}