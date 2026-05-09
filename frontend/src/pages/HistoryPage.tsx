// frontend/src/pages/HistoryPage.tsx

import { useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Clock, List, RotateCw, XCircle } from 'lucide-react'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'
import { labelOf, RUN_TYPE_LABELS, TRIGGER_TYPE_LABELS } from '@/lib/labels'
import { EmptyState, PageHeader, Pagination, ResponsiveList, SectionToolbar, useConfirm } from '@/components/ui'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/useToast'

const PAGE_SIZE = 15
type FilterTab = 'all' | 'success' | 'failed' | 'running'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'success', label: '成功' },
  { key: 'failed', label: '失败' },
  { key: 'running', label: '进行中' },
]

async function fetchRuns(limit: number, offset: number) {
  return apiFetch(`/runs?limit=${limit}&offset=${offset}`)
}

async function deleteRun(id: number) {
  return apiFetch(`/runs/${id}`, { method: 'DELETE' })
}

async function batchDeleteRuns(ids: number[]) {
  return apiFetch('/runs/delete', { method: 'POST', body: JSON.stringify({ ids }) })
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'success' || status === 'completed') return <span className="badge badge-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> 完成</span>
  if (status === 'failed' || status === 'error') return <span className="badge badge-danger flex items-center gap-1"><XCircle className="h-3 w-3" /> 失败</span>
  if (status === 'running') return <span className="badge badge-info flex animate-pulse items-center gap-1"><RotateCw className="h-3 w-3" /> 运行中</span>
  if (status === 'pending') return <span className="badge badge-muted flex items-center gap-1"><Clock className="h-3 w-3" /> 等待中</span>
  if (status === 'stopped') return <span className="badge badge-warning">已停止</span>
  if (status === 'partial_success') return <span className="badge badge-warning">部分成功</span>
  return <span className="badge badge-muted">{status}</span>
}

function RunMobileCard({ run, selected, selectMode, onToggleSelect, onDelete, isDeleting }: any) {
  const canDelete = run.status !== 'running' && run.status !== 'pending'
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTouchStart() {
    timerRef.current = setTimeout(() => {
      if (!selected) onToggleSelect()
    }, 500)
  }

  function handleTouchEnd() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  return (
    <div
      className="card card-padding flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 active:bg-cyan-50/50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {selectMode && (
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600" />
        )}
        <Link
            to={`/history/run/${run.id}`}
            onClick={e => { if (selectMode) { e.preventDefault(); e.stopPropagation() } }}
            className="flex min-w-0 flex-1 items-start gap-3"
          >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
            <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{labelOf(RUN_TYPE_LABELS, run.run_type)}</span>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" /> {formatRelativeTime(run.created_at)}</p>
          </div>
        </Link>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Link to={`/history/run/${run.id}`} className="text-sm text-cyan-600 dark:text-cyan-300">查看 →</Link>
        {canDelete && (
          <button type="button" disabled={isDeleting} onClick={onDelete} className="text-xs text-red-500 hover:underline disabled:opacity-50">
            {isDeleting ? '删除中' : '删除'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['runs', page], queryFn: () => fetchRuns(PAGE_SIZE, (page - 1) * PAGE_SIZE) })

  const deleteMutation = useMutation({ mutationFn: deleteRun, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['runs'] }); toast.success('推荐历史已删除') }, onError: (err: Error) => toast.error('删除失败', err.message) })
  const batchDeleteMutation = useMutation({ mutationFn: batchDeleteRuns, onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['runs'] }); toast.success(`已删除 ${res.deleted} 条推荐历史`); setSelected(new Set()); setSelectMode(false) }, onError: (err: Error) => toast.error('批量删除失败', err.message) })

  const runs = (data as any)?.runs || []
  const total = Number((data as any)?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filteredRuns = useMemo(() => {
    if (filter === 'all') return runs
    return runs.filter((r: any) => {
      if (filter === 'success') return r.status === 'success' || r.status === 'completed'
      if (filter === 'failed') return r.status === 'failed' || r.status === 'error'
      if (filter === 'running') return r.status === 'running' || r.status === 'pending'
      return false
    })
  }, [runs, filter])

  const isFiltered = filter !== 'all'
  const paginationNote = isFiltered
    ? `当前页筛选结果，共 ${filteredRuns.length} 条（后端支持状态筛选后可分页）`
    : null

  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }
  const clearSelected = () => { setSelected(new Set()); setSelectMode(false) }
  const enterSelectMode = (id: number) => { setSelectMode(true); setSelected(new Set([id])) }

  if (isLoading) return <div className="page space-y-4"><PageHeader title="推荐历史" subtitle="查看每次推荐、同步任务的执行状态和详情。" /><TableSkeleton rows={8} /></div>
  if (error) return <div className="page text-red-500">加载失败: {(error as Error).message}</div>

  return (
    <div className="page space-y-4">
      <PageHeader title="推荐历史" subtitle="查看每次推荐、同步任务的执行状态和详情。" />
      <SectionToolbar
        left={
          <div className="flex gap-2 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button key={tab.key} type="button" onClick={() => { setFilter(tab.key); setPage(1); clearSelected() }}
                className={filter === tab.key ? 'rounded-xl bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-300' : 'rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'}>
                {tab.label}
              </button>
            ))}
          </div>
        }
        right={
          selectMode && selected.size > 0 ? (
            <>
              <span className="text-xs font-medium text-cyan-600">已选 {selected.size} 条</span>
              <button type="button" disabled={batchDeleteMutation.isPending} className="btn-danger text-xs"
                onClick={async () => { const ok = await confirmDanger(`确定删除选中的 ${selected.size} 条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。`, '批量删除推荐历史'); if (!ok) return; batchDeleteMutation.mutate(Array.from(selected)) }}>
                {batchDeleteMutation.isPending ? '删除中...' : `删除 ${selected.size} 条`}
              </button>
              <button type="button" onClick={clearSelected} className="btn-secondary text-xs">取消</button>
            </>
          ) : null
        }
      />
      <ResponsiveList<any>
        items={filteredRuns}
        getKey={run => run.id}
        empty={<EmptyState icon={List} title="暂无推荐历史" description="还没有执行过推荐任务。你可以先去任务执行页生成第一组歌单。" actionLabel="去执行推荐" actionTo="/jobs" />}
        renderMobileItem={run => (
          <RunMobileCard
            run={run}
            selected={selected.has(run.id)}
            selectMode={selectMode}
            onToggleSelect={() => {
              if (!selectMode) { enterSelectMode(run.id); return }
              toggleSelected(run.id)
            }}
            isDeleting={deleteMutation.isPending}
            onDelete={async () => { const ok = await confirmDanger('确定删除这条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。', '删除推荐历史'); if (!ok) return; deleteMutation.mutate(run.id) }}
          />
        )}
        renderTableHeader={() => (
          <tr>
            <th className="w-10 p-3 text-left">
              <input
                type="checkbox"
                checked={selected.size === runs.length && runs.length > 0}
                onChange={e => {
                  if (e.target.checked) setSelected(new Set(runs.map((r: any) => r.id)))
                  else clearSelected()
                }}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
            </th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">任务</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">状态</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">触发</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">时间</th>
            <th className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">操作</th>
          </tr>
        )}
        renderTableRow={run => {
          const canDelete = run.status !== 'running' && run.status !== 'pending'
          return (
            <>
              <td className="p-3"><input type="checkbox" checked={selected.has(run.id)} onChange={() => toggleSelected(run.id)} className="h-4 w-4 rounded border-slate-300 text-cyan-600" /></td>
              <td className="p-3"><Link to={`/history/run/${run.id}`} className="font-semibold text-slate-900 hover:text-cyan-600 dark:text-slate-50 dark:hover:text-cyan-300">{labelOf(RUN_TYPE_LABELS, run.run_type)}</Link></td>
              <td className="p-3"><RunStatusBadge status={run.status} /></td>
              <td className="p-3 text-xs text-slate-500">{labelOf(TRIGGER_TYPE_LABELS, run.trigger_type)}</td>
              <td className="p-3 text-xs text-slate-500">{formatRelativeTime(run.created_at)}</td>
              <td className="p-3 text-right">
                <div className="flex justify-end gap-2">
                  <Link to={`/history/run/${run.id}`} className="text-sm text-cyan-600 hover:underline dark:text-cyan-300">查看</Link>
                  {canDelete && (
                    <button type="button" disabled={deleteMutation.isPending} onClick={async () => { const ok = await confirmDanger('确定删除这条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。', '删除推荐历史'); if (!ok) return; deleteMutation.mutate(run.id) }}
                      className="text-sm text-red-500 hover:underline disabled:opacity-50">删除</button>
                  )}
                </div>
              </td>
            </>
          )
        }}
      />
      {isFiltered ? (
        <div className="rounded-xl border border-border bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {paginationNote}
        </div>
      ) : (
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={next => { setPage(next); clearSelected() }} />
      )}
    </div>
  )
}
