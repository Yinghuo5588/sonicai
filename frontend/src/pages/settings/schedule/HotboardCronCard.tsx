// frontend/src/pages/settings/schedule/HotboardCronCard.tsx

import { SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function HotboardCronCard({ s, handleChange }: ScheduleCardProps) {
  const threshold = Number(s.hotboard_match_threshold ?? 0.75)

  return (
    <SectionCard title="网易云热榜定时同步">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">定时从网易云抓取热榜并同步到 Navidrome。</p>
      <label className="mb-3 flex items-center gap-2">
        <input type="checkbox" checked={!!s.hotboard_cron_enabled} onChange={e => handleChange('hotboard_cron_enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        <span className="text-sm text-slate-700 dark:text-slate-200">启用热榜定时同步</span>
      </label>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Cron 表达式</label>
          <input type="text" value={String(s.hotboard_cron_expression ?? '')} onChange={e => handleChange('hotboard_cron_expression', e.target.value)} placeholder="0 9 * * *" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">抓取数量</label>
          <input type="number" min={1} max={200} value={Number(s.hotboard_limit ?? 50)} onChange={e => handleChange('hotboard_limit', Number(e.target.value))} className="input" />
        </div>
      </div>
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{Math.round(threshold * 100)}%</span>
        </div>
        <input type="range" min={50} max={95} value={Math.round(threshold * 100)} onChange={e => handleChange('hotboard_match_threshold', Number(e.target.value) / 100)} className="w-full accent-orange-500" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="text" placeholder="歌单名称，留空自动" value={String(s.hotboard_playlist_name ?? '')} onChange={e => handleChange('hotboard_playlist_name', e.target.value)} className="input" />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!s.hotboard_overwrite} onChange={e => handleChange('hotboard_overwrite', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          覆盖同名歌单
        </label>
      </div>
    </SectionCard>
  )
}