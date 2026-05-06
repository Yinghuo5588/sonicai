import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'
import { Clock, CheckCircle, XCircle, RotateCw, List } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import {
  RUN_TYPE_LABELS,
  TRIGGER_TYPE_LABELS,
  labelOf,
} from '@/lib/labels'

const PAGE_SIZE = 15

async function fetchRuns(limit: number, offset: number) {
  return apiFetch(`/runs?limit=${limit}&offset=${offset}`)
}

async function deleteRun(id: number) {
  return apiFetch(`/runs/${id}`, { method: 'DELETE' })
}

async function batchDeleteRuns(ids: number[]) {
  return apiFetch('/runs/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

function runTypeLabel(type: string) {
  return labelOf(RUN_TYPE_LABELS, type)
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
function RunCard({ run, onDelete, isDeleting }: { run: any; onDelete: () => void; isDeleting: boolean }) {
  const canDelete = run.status !== 'running' && run.status !== 'pending'
  return (
    <div className="card card-padding flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
      <Link
        to={`/history/run/${run.id}`}
        className="flex items-start gap-3 flex-1 min-w-0"
      >
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
      </Link>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Link
          to={`/history/run/${run.id}`}
          className="text-cyan-600 dark:text-cyan-300 text-sm"
        >
          查看 →
        </Link>
        {canDelete && (
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            {isDeleting ? '删除中' : '删除'}
          </button>
        )}
      </div>
    </div>
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
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', page, filter],
    queryFn: () => fetchRuns(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      toast.success('推荐历史已删除')
    },
    onError: (error: Error) => {
      toast.error('删除失败', error.message)
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteRuns,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      toast.success(`已删除 ${res.deleted} 条推荐历史`)
      setSelected(new Set())
    },
    onError: (error: Error) => {
      toast.error('批量删除失败', error.message)
    },
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">推荐历史</h1>
          <p className="page-subtitle mt-1">查看每次推荐、同步任务的执行状态和详情。</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-cyan-600 font-medium">已选 {selected.size} 条</span>
            <button
              onClick={() => {
                if (!confirm(`确定删除选中的 ${selected.size} 条推荐历史吗？`)) return
                batchDeleteMutation.mutate(Array.from(selected))
              }}
              disabled={batchDeleteMutation.isPending}
              className="btn btn-danger text-xs"
            >
              {batchDeleteMutation.isPending ? '删除中...' : `删除${selected.size}条`}
            </button>
            <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs">取消</button>
          </div>
        )}
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
          <EmptyState
            icon={List}
            title="暂无推荐历史"
            description="还没有执行过推荐任务。你可以先去任务执行页生成第一组歌单。"
            actionLabel="去执行推荐"
            actionTo="/jobs"
          />
        )}
        {filteredRuns.map((r: any) => (
          <RunCard
            key={r.id}
            run={r}
            isDeleting={deleteMutation.isPending}
            onDelete={() => {
              if (!confirm('确定删除这条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。')) return
              deleteMutation.mutate(r.id)
            }}
          />
        ))}
      </div>

      {/* 桌面端列表 */}
      <div className="hidden md:block card overflow-hidden">
        {runs.length === 0 && <EmptyState
          icon={List}
          title="暂无推荐历史"
          description="还没有执行过推荐任务。你可以先去任务执行页生成第一组歌单。"
          actionLabel="去执行推荐"
          actionTo="/jobs"
        />}
        {runs.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-border/50">
            <input
              type="checkbox"
              checked={selected.size === runs.length && runs.length > 0}
              onChange={e => {
                if (e.target.checked) setSelected(new Set(runs.map((r: any) => r.id)))
                else setSelected(new Set())
              }}
              className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">全选本页</span>
          </div>
        )}
        <div className="divide-y divide-border/50">
          {runs.map((r: any) => {
            const canDelete = r.status !== 'running' && r.status !== 'pending'
            return (
              <div key={r.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={e => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(r.id)
                        else next.delete(r.id)
                        setSelected(next)
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 mt-0.5 shrink-0"
                    />
                    <Link to={`/history/run/${r.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{runTypeLabel(r.run_type)}</span>
                        <RunStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(r.created_at)}
                      </p>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.trigger_type && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {labelOf(TRIGGER_TYPE_LABELS, r.trigger_type)}
                      </span>
                    )}
                    <Link
                      to={`/history/run/${r.id}`}
                      className="text-cyan-600 dark:text-cyan-300 text-sm"
                    >
                      查看 →
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (!confirm('确定删除这条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。')) return
                          deleteMutation.mutate(r.id)
                        }}
                        className="text-sm text-red-500 hover:underline disabled:opacity-50"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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