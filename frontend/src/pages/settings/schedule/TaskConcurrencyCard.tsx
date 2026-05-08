// frontend/src/pages/settings/schedule/TaskConcurrencyCard.tsx

import { FieldInput, SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'

export default function TaskConcurrencyCard({ s, handleChange }: ScheduleCardProps) {
  return (
    <SectionCard title="任务执行策略">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">控制 SonicAI 后台任务的最大并发数量。</p>
      <FieldInput fieldKey="max_concurrent_tasks" value={s.max_concurrent_tasks} onChange={v => handleChange('max_concurrent_tasks', v)} />
      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        说明：全局并发数不等于业务互斥。业务互斥仍由后端任务锁控制。
      </div>
    </SectionCard>
  )
}