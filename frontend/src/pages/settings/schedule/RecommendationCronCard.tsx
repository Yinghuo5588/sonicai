// frontend/src/pages/settings/schedule/RecommendationCronCard.tsx

import { FieldInput, SectionCard, Tooltip } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function RecommendationCronCard({ s, handleChange }: ScheduleCardProps) {
  return (
    <SectionCard title="Last.fm 推荐歌单定时生成">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">定时基于 Last.fm 听歌数据生成推荐歌单。</p>
      <label className="mb-3 flex items-center gap-2">
        <input type="checkbox" checked={!!s.cron_enabled} onChange={e => handleChange('cron_enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
        <span className="text-sm text-slate-700 dark:text-slate-200">启用 Last.fm 推荐定时生成</span>
      </label>
      <div className="mb-3">
        <FieldInput fieldKey="recommendation_cron_run_type" value={s.recommendation_cron_run_type ?? 'full'} onChange={v => handleChange('recommendation_cron_run_type', v)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Cron 表达式 <Tooltip text="分 时 日 月 周，例如 0 8 * * * 表示每天 8 点执行。" />
        </label>
        <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)} placeholder="0 8 * * *" className="input" />
      </div>
    </SectionCard>
  )
}