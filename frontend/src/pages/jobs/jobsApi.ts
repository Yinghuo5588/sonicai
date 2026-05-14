// frontend/src/pages/jobs/jobsApi.ts

import apiFetch from '@/lib/api'
import type { LastfmRunType } from './jobsTypes'

export function fetchSettings() {
  return apiFetch('/settings')
}

export function triggerLastfmJob(type: LastfmRunType) {
  const endpointMap: Record<LastfmRunType, string> = {
    full: '/jobs/run-all',
    similar_tracks: '/jobs/run-similar-tracks',
    similar_artists: '/jobs/run-similar-artists',
  }
  return apiFetch(endpointMap[type], { method: 'POST' })
}

export function triggerHotboardJob({ limit, threshold, playlistName, overwrite }: { limit: number; threshold: number; playlistName?: string; overwrite: boolean }) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('match_threshold', String(threshold))
  if (playlistName?.trim()) params.set('playlist_name', playlistName.trim())
  params.set('overwrite', String(overwrite))
  return apiFetch(`/hotboard/sync?${params.toString()}`, { method: 'POST' })
}

export function triggerPlaylistJob({ url, threshold, playlistName, overwrite }: { url: string; threshold: number; playlistName?: string; overwrite: boolean }) {
  const params = new URLSearchParams()
  params.set('url', url)
  params.set('match_threshold', String(threshold))
  if (playlistName?.trim()) params.set('playlist_name', playlistName.trim())
  params.set('overwrite', String(overwrite))
  return apiFetch(`/playlist/sync?${params.toString()}`, { method: 'POST' })
}

export async function triggerTextPlaylistJob({ file, threshold, playlistName, overwrite }: { file: File; threshold: number; playlistName?: string; overwrite: boolean }) {
  const formData = new FormData()
  formData.append('file', file)
  const params = new URLSearchParams()
  params.set('match_threshold', String(threshold))
  params.set('overwrite', String(overwrite))
  if (playlistName?.trim()) params.set('playlist_name', playlistName.trim())
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/playlist/sync-text?${params.toString()}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export function triggerAiJob({
  prompt,
  limit,
  threshold,
  playlistName,
  overwrite,
}: {
  prompt: string
  limit?: number
  threshold: number
  playlistName?: string
  overwrite: boolean
}) {
  return apiFetch('/ai/recommend', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      limit,
      playlist_name: playlistName?.trim() || null,
      match_threshold: threshold,
      overwrite,
    }),
  })
}