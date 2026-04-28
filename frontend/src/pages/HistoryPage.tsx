import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'

async function fetchRuns() {
  return apiFetch('/runs')
}

function runTypeLabel(type: string) {
  return type === 'full' ? '完整推荐' : type === 'similar_tracks' ? '相似曲目' : type === 'similar_artists' ? '相邻艺术家' : type
}

function statusBadge(status: string) {
  const cls = status === 'success' ? 'bg-green-100 text-green-700'
    : status === 'failed' ? 'bg-red-100 text-red-700'
    : status === 'running' ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

export default function HistoryPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['runs'], queryFn: fetchRuns })

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>
  if (error) return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">推荐历史</h1>
      <p className="text-red-500 text-sm">加载失败：{(error as Error).message}</p>
    </div>
  )

  const runs = data || []

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">推荐历史</h1>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {runs.length === 0 && (
          <p className="p-4 text-slate-400 text-center text-sm">暂无记录</p>
        )}
        {runs.map((r: any) => (
          <Link
            key={r.id}
            to={`/history/run/${r.id}`}
            className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{runTypeLabel(r.run_type)}</span>
                {statusBadge(r.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(r.created_at)}</p>
            </div>
            <span className="text-blue-400 text-sm ml-2">查看 →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
