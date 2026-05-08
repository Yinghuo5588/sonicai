// frontend/src/pages/jobs/jobsTypes.ts

import type { Settings } from '@/types/api'

export type JobPanel = 'lastfm' | 'hotboard' | 'playlist' | 'text'

export type LastfmRunType = 'full' | 'similar_tracks' | 'similar_artists'

export interface SubmittedRun {
  runId: number
  title: string
  message?: string
}

export interface JobPanelProps {
  settings?: Partial<Settings>
  onSubmitted: (run: SubmittedRun) => void
}

export interface PreflightItem {
  label: string
  ok: boolean
  hint?: string
}