// frontend/src/pages/settings/schedule/scheduleTypes.ts

export type SettingsLike = Record<string, unknown>
export type SettingsHandleChange = (key: string, value: unknown) => void
export interface ScheduleCardProps {
  s: SettingsLike
  handleChange: SettingsHandleChange
}

export interface PlaylistRetentionPolicy {
  id: number
  playlist_type: string
  enabled: boolean
  keep_days: number
  delete_navidrome: boolean
  keep_recent_success_count: number
  created_at?: string | null
  updated_at?: string | null
}

export interface PlaylistRetentionPoliciesResponse {
  items: PlaylistRetentionPolicy[]
}

export interface PlaylistCleanupPreviewItem {
  playlist_id: number
  run_id: number
  playlist_name: string
  playlist_type: string
  created_at: string | null
  navidrome_playlist_id: string | null
  reason: string
  keep_days?: number
  delete_navidrome?: boolean
}

export interface PlaylistCleanupPreviewResponse {
  total: number
  by_type: Record<string, number>
  operation_stats?: {
    delete_navidrome_count?: number
    clear_local_only_count?: number
    skip_disabled_count?: number
    skip_failed_count?: number
    skip_recent_keep_count?: number
  }
  items: PlaylistCleanupPreviewItem[]
}

export interface PlaylistCleanupRunResponse {
  scanned: number
  deleted_navidrome_count: number
  failed_navidrome_count: number
  updated_local_count: number
  failed_items: Array<{
    playlist_id: number
    playlist_name: string
    navidrome_playlist_id: string
    error: string
  }>
}