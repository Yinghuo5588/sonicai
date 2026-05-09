// frontend/src/pages/settings/library/libraryApi.ts

import type { LibraryStatus } from '@/types/api'

import apiFetch from '@/lib/api'
import {
  CreateManualMatchPayload,
  DebugMatchPayload,
  LIBRARY_PAGE_SIZE,
} from './libraryTypes'

export function fetchLibraryStatus(): Promise<LibraryStatus> {
  return apiFetch('/library/status') as Promise<LibraryStatus>
}

export function triggerLibrarySync() {
  return apiFetch('/library/sync', { method: 'POST' })
}

export function fetchLibrarySongs(q: string, page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(LIBRARY_PAGE_SIZE))
  params.set('offset', String((page - 1) * LIBRARY_PAGE_SIZE))
  if (q.trim()) params.set('q', q.trim())
  return apiFetch(`/library/songs?${params.toString()}`)
}

export function fetchMatchLogs(page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(LIBRARY_PAGE_SIZE))
  params.set('offset', String((page - 1) * LIBRARY_PAGE_SIZE))
  return apiFetch(`/library/match-logs?${params.toString()}`)
}

export function clearOldMatchLogs(days: number) {
  return apiFetch(`/library/match-logs/old?days=${days}`, { method: 'DELETE' })
}

export function fetchManualMatches(page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(LIBRARY_PAGE_SIZE))
  params.set('offset', String((page - 1) * LIBRARY_PAGE_SIZE))
  return apiFetch(`/library/manual-matches?${params.toString()}`)
}

export function createManualMatch(payload: CreateManualMatchPayload) {
  return apiFetch('/library/manual-matches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteManualMatch(id: number) {
  return apiFetch(`/library/manual-matches/${id}`, { method: 'DELETE' })
}

export function clearMatchCache() {
  return apiFetch('/library/match-cache', { method: 'DELETE' })
}

export function clearLowConfidenceCache(maxScore: number) {
  return apiFetch(`/library/match-cache/low-confidence?max_score=${maxScore}`, { method: 'DELETE' })
}

export function debugMatch(payload: DebugMatchPayload) {
  return apiFetch('/library/debug-match', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMissedTracks(status: string, q: string, page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(LIBRARY_PAGE_SIZE))
  params.set('offset', String((page - 1) * LIBRARY_PAGE_SIZE))
  if (status) params.set('status', status)
  if (q.trim()) params.set('q', q.trim())
  return apiFetch(`/missed-tracks?${params.toString()}`)
}

export function fetchMissedTrackStats() {
  return apiFetch('/missed-tracks/stats')
}

export function retryMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/retry`, { method: 'POST' })
}

export function retryMissedTracksBatch() {
  return apiFetch('/missed-tracks/retry', { method: 'POST' })
}

export function ignoreMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/ignore`, { method: 'POST' })
}

export function resetMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/reset`, { method: 'POST' })
}

export function deleteMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}`, { method: 'DELETE' })
}