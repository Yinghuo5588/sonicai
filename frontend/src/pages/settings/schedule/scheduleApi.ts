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

// ── AI recommendation scheduled jobs ─────────────────────────────────────────

export function fetchAIRecommendationJobs() {
  return apiFetch('/ai/jobs')
}

export function createAIRecommendationJob(payload: Record<string, unknown>) {
  return apiFetch('/ai/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAIRecommendationJob(id: number, payload: Record<string, unknown>) {
  return apiFetch(`/ai/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAIRecommendationJob(id: number) {
  return apiFetch(`/ai/jobs/${id}`, {
    method: 'DELETE',
  })
}

export function runAIRecommendationJob(id: number) {
  return apiFetch(`/ai/jobs/${id}/run`, {
    method: 'POST',
  })
}

// ── Playlist sync jobs ───────────────────────────────────────────────────────

export function fetchPlaylistSyncJobs() {
  return apiFetch('/playlist-sync-jobs')
}

export function createPlaylistSyncJob(payload: Record<string, unknown>) {
  return apiFetch('/playlist-sync-jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updatePlaylistSyncJob(id: number, payload: Record<string, unknown>) {
  return apiFetch(`/playlist-sync-jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deletePlaylistSyncJob(id: number) {
  return apiFetch(`/playlist-sync-jobs/${id}`, {
    method: 'DELETE',
  })
}

export function runPlaylistSyncJob(id: number) {
  return apiFetch(`/playlist-sync-jobs/${id}/run`, {
    method: 'POST',
  })
}

export function resetPlaylistSyncJobHash(id: number) {
  return apiFetch(`/playlist-sync-jobs/${id}/reset-hash`, {
    method: 'POST',
  })
}