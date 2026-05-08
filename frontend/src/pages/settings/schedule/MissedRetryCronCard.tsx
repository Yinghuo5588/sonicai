// frontend/src/pages/settings/schedule/MissedRetryCronCard.tsx

import { FieldInput, SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function MissedRetryCronCard({ s, handleChange }: ScheduleCardProps) {
  return (
    <SectionCard title="缺失歌曲定时重试">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">定时重试未命中歌曲。建议在补库后开启，并启用「重试前刷新曲库索引」。</p>
      <FieldInput fieldKey="missed_track_retry_enabled" value={s.missed_track_retry_enabled} onChange={v => handleChange('missed_track_retry_enabled', v)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Cron 表达式</label>
          <input type="text" value={String(s.missed_track_retry_cron ?? '0 3 * * *')} onChange={e => handleChange('missed_track_retry_cron', e.target.value)} className="input" />
        </div>
        <FieldInput fieldKey="missed_track_retry_limit" value={s.missed_track_retry_limit} onChange={v => handleChange('missed_track_retry_limit', v)} />
      </div>
      <FieldInput fieldKey="missed_track_retry_refresh_library" value={s.missed_track_retry_refresh_library} onChange={v => handleChange('missed_track_retry_refresh_library', v)} />
      <FieldInput fieldKey="missed_track_retry_mode" value={s.missed_track_retry_mode} onChange={v => handleChange('missed_track_retry_mode', v)} />
    </SectionCard>
  )
}