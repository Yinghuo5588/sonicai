// frontend/src/pages/settings/schedule/HistoryCleanupCard.tsx

import { FieldInput, SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function HistoryCleanupCard({ s, handleChange }: ScheduleCardProps) {
  return (
    <SectionCard title="历史记录清理">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">控制 SonicAI 数据库中的推荐历史和 Webhook 记录保留时间。这里不会删除 Navidrome 中已经创建的歌单。</p>
      <FieldInput fieldKey="history_cleanup_enabled" value={s.history_cleanup_enabled} onChange={v => handleChange('history_cleanup_enabled', v)} />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput fieldKey="run_history_keep_days" value={s.run_history_keep_days} onChange={v => handleChange('run_history_keep_days', v)} />
        <FieldInput fieldKey="webhook_history_keep_days" value={s.webhook_history_keep_days} onChange={v => handleChange('webhook_history_keep_days', v)} />
      </div>
      <FieldInput fieldKey="keep_failed_history" value={s.keep_failed_history} onChange={v => handleChange('keep_failed_history', v)} />
      <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        注意：这里清理的是 SonicAI 的数据库历史记录，不会自动删除 Navidrome 中已生成的歌单。
      </div>
    </SectionCard>
  )
}