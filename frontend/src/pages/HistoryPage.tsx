import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

async function fetchRuns() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['runs'], queryFn: fetchRuns })

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const runs = data || []

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">推荐历史</h1>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {runs.length === 0 && (
          <p className="p-4 text-slate-400 text-center text-sm">暂无记录</p>
        )}
        {runs.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800 truncate">{r.run_type}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                  r.status === 'success' ? 'bg-green-100 text-green-700' :
                  r.status === 'failed' ? 'bg-red-100 text-red-700' :
                  r.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{r.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{r.created_at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
