// frontend/src/pages/settings/schedule/PlaylistSyncCronCard.tsx

import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { SectionCard } from '../SettingsShared'
import { triggerIncrementalPlaylistSync } from './scheduleApi'
import type { ScheduleCardProps } from './scheduleTypes'

function TriggerIncrementalSync() {
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: triggerIncrementalPlaylistSync,
    onSuccess: (data: any) => toast.success('增量同步已提交', `Run ID: ${data?.run_id ?? '-'}`),
    onError: (err: any) => toast.error('同步失败', err?.detail || err?.message || '未知错误'),
  })

  return (
    <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-secondary mt-2 text-xs">
      {mutation.isPending ? <><Zap className="h-3.5 w-3.5 animate-pulse" /> 同步中...</> :
       mutation.isSuccess  ? <><CheckCircle className="h-3.5 w-3.5" /> 已提交</> :
       mutation.isError   ? <><XCircle className="h-3.5 w-3.5" /> 重试</> :
       <><Zap className="h-3.5 w-3.5" /> 立即同步</>}
    </button>
  )
}

export default function PlaylistSyncCronCard({ s, handleChange }: ScheduleCardProps) {
  const threshold = Number(s.playlist_sync_threshold ?? 0.75)

  return (
    <SectionCard title="歌单链接定时同步">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">监控指定歌单链接，变化时自动增量同步到 Navidrome。</p>
      <label className="mb-3 flex items-center gap-2">
        <input type="checkbox" checked={!!s.playlist_sync_cron_enabled} onChange={e => handleChange('playlist_sync_cron_enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        <span className="text-sm text-slate-700 dark:text-slate-200">启用歌单定时同步</span>
      </label>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Cron 表达式</label>
          <input type="text" placeholder="0 */6 * * *，每 6 小时" value={String(s.playlist_sync_cron_expression ?? '')} onChange={e => handleChange('playlist_sync_cron_expression', e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">歌单链接</label>
          <input type="text" placeholder="https://music.163.com/playlist?id=xxx" value={String(s.playlist_sync_url ?? '')} onChange={e => handleChange('playlist_sync_url', e.target.value)} className="input" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{Math.round(threshold * 100)}%</span>
            </div>
            <input type="range" min={50} max={95} value={Math.round(threshold * 100)} onChange={e => handleChange('playlist_sync_threshold', Number(e.target.value) / 100)} className="w-full accent-orange-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">歌单名称</label>
            <input type="text" placeholder="留空自动" value={String(s.playlist_sync_name ?? '')} onChange={e => handleChange('playlist_sync_name', e.target.value)} className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!s.playlist_sync_overwrite} onChange={e => handleChange('playlist_sync_overwrite', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          每次全量覆盖，默认增量追加新歌
        </label>
        {s.playlist_sync_cron_enabled && s.playlist_sync_url && <TriggerIncrementalSync />}
      </div>
    </SectionCard>
  )
}