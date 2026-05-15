// frontend/src/pages/settings/library/libraryTypes.ts

export const LIBRARY_PAGE_SIZE = 6

export type LibraryToolTab =
  | 'status'
  | 'songs'
  | 'favorites'
  | 'missed'
  | 'match'
  | 'manual'

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

export interface LibraryFavoritesStatus {
  total: number
  sync_enabled: boolean
  sync_cron: string | null
  last_sync_at: string | null
  last_error: string | null
  ai_sample_limit: number
}

export interface LibraryStatus {
  total_songs: number
  cache: SongCacheStatus
  favorites?: LibraryFavoritesStatus
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

export interface MissedTrackItem {
  id: number
  title: string
  artist: string | null
  status: 'pending' | 'matched' | 'failed' | 'ignored'
  source: string | null
  seen_count: number
  retry_count: number
  max_retries: number
  match_threshold: number
  last_seen_at: string | null
  last_retry_at: string | null
  matched_at: string | null
  matched_navidrome_id: string | null
  last_error: string | null
  created_at: string | null
}

export interface MissedTracksResponse {
  total: number
  items: MissedTrackItem[]
}

export interface MissedTrackStats {
  pending: number
  matched: number
  failed: number
  ignored: number
  total: number
}

export interface DebugMatchPayload {
  title: string
  artist?: string
  threshold: number
}

export interface MatchStep {
  step: string
  hit: boolean
  candidates_count?: number
  best_score?: number | null
  threshold?: number | null
  duration_ms?: number | null
  top_candidates?: any[]
  best_candidate?: any
  title_aliases?: string[]
  artist_aliases?: string[]
  error?: string | null
}

export interface DebugMatchResponse {
  input?: Record<string, unknown>
  result?: any
  steps?: MatchStep[]
  total_elapsed_ms?: number
  cache_status?: SongCacheStatus
}

// ── Favorite Tracks ────────────────────────────────────────────────────────────

export interface FavoriteTrackItem {
  id: number
  navidrome_id: string
  title: string
  artist: string | null
  album: string | null
  duration: number | null
  starred_at: string | null
  last_seen_at: string | null
}

export interface FavoriteTracksResponse {
  total: number
  items: FavoriteTrackItem[]
}