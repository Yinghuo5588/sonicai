import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'

async function fetchDashboard() {
  return apiFetch('/dashboard/summary')
}

function StatCard({ label, value, color = 'text-slate-900 dark:text-slate-50' }: { label: string; value: number; color?: string }) {
  return (
    <div className="card card-padding">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>
  if (error) return <div className="p-4 text-red-500">加载失败</div>
  const d = data || {}

  return (
    <div className="page">
      <div>
        <h1 className="page-title">仪表盘</h1>
        <p className="page-subtitle mt-1">查看推荐任务、歌单生成和 Webhook 统计。</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="总执行次数" value={d.total_runs ?? 0} />
        <StatCard label="生成歌单" value={d.total_playlists ?? 0} />
        <StatCard label="命中歌曲" value={d.total_matched ?? 0} color="text-green-600" />
        <StatCard label="缺失歌曲" value={d.total_missing ?? 0} color={(d.total_missing ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Webhook 成功" value={d.webhook_success_count ?? 0} color="text-green-600" />
        <StatCard label="Webhook 失败" value={d.webhook_failed_count ?? 0} color="text-red-500" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="待补库歌曲"
          value={d.missed_tracks_pending ?? 0}
          color={(d.missed_tracks_pending ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'}
        />
        <StatCard
          label="补库后已匹配"
          value={d.missed_tracks_matched ?? 0}
          color="text-green-600"
        />
        <StatCard
          label="补库重试失败"
          value={d.missed_tracks_failed ?? 0}
          color={(d.missed_tracks_failed ?? 0) > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-50'}
        />
        <StatCard
          label="已忽略缺失"
          value={d.missed_tracks_ignored ?? 0}
          color="text-slate-400"
        />
      </div>
      {d.last_run && (
        <div className="card card-padding">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">最近执行</h2>
          <p className="text-slate-800 dark:text-slate-100">
            <span className="font-medium">{d.last_run.run_type}</span>
            {' · '}
            <span className={`text-sm ${d.last_run.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>{d.last_run.status}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(d.last_run.created_at)}</p>
        </div>
      )}
    </div>
  )
}
