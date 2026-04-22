import { useQuery } from '@tanstack/react-query'

async function fetchDashboard() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>

  const d = data || {}

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">仪表盘</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="总执行次数" value={d.total_runs ?? 0} />
        <StatCard label="生成歌单" value={d.total_playlists ?? 0} />
        <StatCard label="命中歌曲" value={d.total_matched ?? 0} color="text-green-600" />
        <StatCard label="缺失歌曲" value={d.total_missing ?? 0} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Webhook 成功" value={d.webhook_success_count ?? 0} color="text-green-600" />
        <StatCard label="Webhook 失败" value={d.webhook_failed_count ?? 0} color="text-red-500" />
      </div>

      {d.last_run && (
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <h2 className="text-sm font-medium text-slate-500 mb-2">最近执行</h2>
          <p className="text-slate-800">
            <span className="font-medium">{d.last_run.run_type}</span>
            {' · '}
            <span className={`text-sm ${statusColor(d.last_run.status)}`}>{d.last_run.status}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{d.last_run.created_at}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'text-slate-800' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    success: 'text-green-600',
    failed: 'text-red-500',
    running: 'text-blue-500',
    pending: 'text-slate-400',
    partial_success: 'text-amber-600',
  }
  return map[status] || 'text-slate-600'
}