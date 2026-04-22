import { useQuery } from '@tanstack/react-query'

async function fetchRuns() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/runs', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['runs'], queryFn: fetchRuns })

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>

  const runs = data || []

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">推荐历史</h1>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">ID</th>
              <th className="text-left p-3 font-medium text-slate-600">类型</th>
              <th className="text-left p-3 font-medium text-slate-600">状态</th>
              <th className="text-left p-3 font-medium text-slate-600">时间</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-slate-400 text-center">暂无记录</td></tr>
            )}
            {runs.map((r: any) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-slate-800">{r.id}</td>
                <td className="p-3 text-slate-600">{r.run_type}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.status === 'success' ? 'bg-green-100 text-green-700' :
                    r.status === 'failed' ? 'bg-red-100 text-red-700' :
                    r.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{r.status}</span>
                </td>
                <td className="p-3 text-slate-400 text-xs">{r.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}