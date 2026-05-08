// frontend/src/pages/settings/schedule/CurrentTasksCard.tsx

import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { SectionCard } from '../SettingsShared'
import { fetchTaskStatus } from './scheduleApi'

export default function CurrentTasksCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['task-status'],
    queryFn: fetchTaskStatus,
    refetchInterval: 5000,
  })

  const activeTasks = (data as any)?.active_tasks || []

  return (
    <SectionCard title="当前后台任务" description="通过 create_background_task 注册的后台任务。Cron 任务由 APScheduler 直接执行，不一定全部出现在这里。">
      {isLoading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">加载任务状态...</div>
      ) : activeTasks.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">当前没有后台任务运行</div>
      ) : (
        <div className="space-y-2">
          {activeTasks.map((name: string) => (
            <div key={name} className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
              <Activity className="h-4 w-4 animate-pulse" />
              {name}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}