// frontend/src/pages/settings/aiPreferenceApi.ts

import apiFetch from '@/lib/api'

export interface AiPreferenceProfile {
  enabled: boolean
  filename: string | null
  content: string
  updated_at: string | null
}

export function fetchAiPreferenceProfile(): Promise<AiPreferenceProfile> {
  return apiFetch('/ai/preference-profile') as Promise<AiPreferenceProfile>
}

export function updateAiPreferenceProfile(payload: {
  content: string
  filename?: string | null
  enabled?: boolean
}) {
  return apiFetch('/ai/preference-profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function uploadAiPreferenceProfile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/ai/preference-profile/upload', {
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

export function deleteAiPreferenceProfile() {
  return apiFetch('/ai/preference-profile', { method: 'DELETE' })
}