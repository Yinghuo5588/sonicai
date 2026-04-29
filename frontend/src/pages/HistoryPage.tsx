import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'

const PAGE_SIZE = 15

async function fetchRuns(limit: number, offset: number) {
  return apiFetch(`/runs?limit=${limit}&offset=${offset}`)
}

function runTypeLabel(type: string) {
  return type === 'full' ? '完整推荐' : type === 'similar_tracks' ? '相似曲目' : type === 'similar_artists' ? '相邻艺术家' : type
}

function statusBadge(status: string) {
  const cls = status === 'success' ? 'badge-success' : status === 'failed' ? 'badge-danger' : status === 'running' ? 'badge-info' : 'badge-muted'
  return <span className={cls}>{status}</span>
}

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', page],
    queryFn: () => fetchRuns(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  })

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>
  if (error) return <div className="p-4 text-red-500">加载失败</div>

  const { runs = [], total = 0 } = data || {}
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page">
      <div>
        <h1 className="page-title">推荐历史</h1>
        <p className="page-subtitle mt-1">查看每次推荐、同步任务的执行状态和详情。</p>
      </div>
      <div className="card overflow-hidden">
        {runs.length === 0 && <p className="p-6 text-slate-400 text-center text-sm">暂无记录</p>}
        <div className="divide-y divide-border">
          {runs.map((r: any) => (
            <Link key={r.id} to={`/history/run/${r.id}`} className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{runTypeLabel(r.run_type)}</span>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatRelativeTime(r.created_at)}</p>
                </div>
                <span className="text-blue-500 dark:text-blue-400 text-sm shrink-0">查看 →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary w-full sm:w-auto">← 上一页</button>
          <span className="text-sm text-slate-500 dark:text-slate-400 px-2">第 {page} / {totalPages} 页，共 {total} 条</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary w-full sm:w-auto">下一页 →</button>
        </div>
      )}
    </div>
  )
}
