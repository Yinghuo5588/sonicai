// frontend/src/pages/settings/schedule/scheduleApi.ts

import apiFetch from '@/lib/api'

export function fetchTaskStatus() {
  return apiFetch('/tasks/status')
}

export function previewPlaylistCleanup() {
  return apiFetch('/tasks/playlist-cleanup/preview', { method: 'POST' })
}

export function runPlaylistCleanup() {
  return apiFetch('/tasks/playlist-cleanup/run', { method: 'POST' })
}

export function fetchRetentionPolicies() {
  return apiFetch('/tasks/playlist-retention-policies')
}

export function updateRetentionPolicy(type: string, payload: Record<string, unknown>) {
  return apiFetch(`/tasks/playlist-retention-policies/${type}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function triggerIncrementalPlaylistSync() {
  return apiFetch('/playlist/sync-incremental', { method: 'POST' })
}

export function triggerFavoriteTracksSync() {
  return apiFetch('/library/favorites/sync', { method: 'POST' })
}