import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'
import { Clock, CheckCircle, XCircle, RotateCw, List } from 'lucide-react'

const PAGE_SIZE = 15

async function fetchRuns(limit: number, offset: number) {
  return apiFetch(`/runs?limit=${limit}&offset=${offset}`)
}

function runTypeLabel(type: string) {
  return type === 'full' ? '完整推荐' : type === 'similar_tracks' ? '相似曲目' : type === 'similar_artists' ? '相邻艺术家' : type
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'success') return <span className="badge badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" />完成</span>
  if (status === 'failed') return <span className="badge badge-danger flex items-center gap-1"><XCircle className="w-3 h-3" />失败</span>
  if (status === 'running') return <span className="badge badge-info animate-pulse flex items-center gap-1"><RotateCw className="w-3 h-3" />运行中</span>
  if (status === 'stopped') return <span className="badge badge-warning flex items-center gap-1">已停止</span>
  if (status === 'partial_success') return <span className="badge badge-warning flex items-center gap-1">部分成功</span>
  return <span className="badge badge-muted">{status}</span>
}

/* ---------- 移动端运行记录卡片 ---------- */
function RunCard({ run }: { run: any }) {
  return (
    <Link
      to={`/history/run/${run.id}`}
      className="card card-padding flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{runTypeLabel(run.run_type)}</span>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(run.created_at)}
          </p>
        </div>
      </div>
      <span className="text-cyan-600 dark:text-cyan-300 text-sm shrink-0">查看 →</span>
    </Link>
  )
}

type FilterTab = 'all' | 'success' | 'failed' | 'running'
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'success', label: '成功' },
  { key: 'failed', label: '失败' },
  { key: 'running', label: '进行中' },
]

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<FilterTab>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', page, filter],
    queryFn: () => fetchRuns(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  })

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>
  if (error) return <div className="p-4 text-red-500">加载失败</div>

  const { runs = [], total = 0 } = data || {}
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 移动端筛选
  const filteredRuns = runs.filter((r: any) => {
    if (filter === 'all') return true
    if (filter === 'success') return r.status === 'success' || r.status === 'completed'
    if (filter === 'failed') return r.status === 'failed' || r.status === 'error'
    if (filter === 'running') return r.status === 'running' || r.status === 'pending'
    return true
  })

  return (
    <div className="page">
      <div>
        <h1 className="page-title">推荐历史</h1>
        <p className="page-subtitle mt-1">查看每次推荐、同步任务的执行状态和详情。</p>
      </div>

      {/* 移动端状态筛选 tabs */}
      <div className="md:hidden overflow-x-auto overscroll-x-contain -mx-4 px-4 pt-1">
        <div className="flex gap-2 min-w-max">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 移动端卡片列表 */}
      <div className="md:hidden space-y-2">
        {filteredRuns.length === 0 && (
          <div className="card card-padding text-center text-slate-400 text-sm">暂无记录</div>
        )}
        {filteredRuns.map((r: any) => (
          <RunCard key={r.id} run={r} />
        ))}
      </div>

      {/* 桌面端列表 */}
      <div className="hidden md:block card overflow-hidden">
        {runs.length === 0 && <p className="p-6 text-slate-400 text-center text-sm">暂无记录</p>}
        <div className="divide-y divide-border/50">
          {runs.map((r: any) => (
            <Link key={r.id} to={`/history/run/${r.id}`} className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{runTypeLabel(r.run_type)}</span>
                    <RunStatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(r.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.trigger_type && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {r.trigger_type === 'manual' ? '手动' : r.trigger_type === 'scheduled' ? '定时' : r.trigger_type}
                    </span>
                  )}
                  <span className="text-cyan-600 dark:text-cyan-300 text-sm shrink-0">查看 →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary w-full sm:w-auto"
          >
            ← 上一页
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400 px-2">
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary w-full sm:w-auto"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  )
}