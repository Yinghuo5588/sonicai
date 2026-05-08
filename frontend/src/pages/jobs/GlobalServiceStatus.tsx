// frontend/src/pages/jobs/GlobalServiceStatus.tsx

import { CheckCircle, XCircle } from 'lucide-react'
import { labelOf, MATCH_MODE_LABELS } from '@/lib/labels'
import type { Settings } from '@/types/api'

function StatusItem({ ok, label }: { ok: boolean; label: React.ReactNode }) {
  return (
    <div className={ok ? 'flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400' : 'flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400'}>
      {ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </div>
  )
}

export default function GlobalServiceStatus({ settings }: { settings?: Partial<Settings> }) {
  return (
    <section className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <div className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">全局服务状态</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatusItem ok={!!settings?.lastfm_api_key} label="Last.fm API Key" />
        <StatusItem ok={!!settings?.lastfm_username} label="Last.fm 用户名" />
        <StatusItem ok={!!settings?.navidrome_url && !!settings?.navidrome_username} label="Navidrome 配置" />
        <StatusItem ok={!!settings?.match_mode} label={<><>匹配模式: {labelOf(MATCH_MODE_LABELS, settings?.match_mode)}</></>} />
      </div>
    </section>
  )
}