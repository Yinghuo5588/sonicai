// frontend/src/pages/settings/schedule/SongCacheCronCard.tsx

import { SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function SongCacheCronCard({ s, handleChange }: ScheduleCardProps) {
  return (
    <SectionCard title="歌曲缓存自动刷新">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">控制内存歌曲缓存是否启用，以及是否定时从曲库索引刷新。</p>
      <label className="mb-3 flex items-center gap-2">
        <input type="checkbox" checked={!!s.song_cache_enabled} onChange={e => handleChange('song_cache_enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        <span className="text-sm text-slate-700 dark:text-slate-200">启用歌曲缓存</span>
      </label>
      <label className="mb-3 flex items-center gap-2">
        <input type="checkbox" checked={!!s.song_cache_auto_refresh_enabled} onChange={e => handleChange('song_cache_auto_refresh_enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        <span className="text-sm text-slate-700 dark:text-slate-200">启用缓存定时刷新</span>
      </label>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">缓存刷新 Cron</label>
        <input type="text" value={String(s.song_cache_refresh_cron ?? '0 4 * * *')} onChange={e => handleChange('song_cache_refresh_cron', e.target.value)} className="input" />
      </div>
    </SectionCard>
  )
}