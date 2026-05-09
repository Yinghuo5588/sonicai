// frontend/src/pages/WebhooksPage.tsx

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Link2, RefreshCw, XCircle } from 'lucide-react'
import apiFetch from '@/lib/api'
import { labelOf, PLAYLIST_TYPE_LABELS, WEBHOOK_STATUS_LABELS } from '@/lib/labels'
import { EmptyState, Pagination, ResponsiveList, SectionToolbar, useConfirm } from '@/components/ui'
import { useToast } from '@/components/ui/useToast'

const PAGE_SIZE = 5

async function fetchBatches(page: number) {
  const offset = (page - 1) * PAGE_SIZE
  return apiFetch('/webhooks/batches?limit=' + PAGE_SIZE + '&offset=' + offset)
}

async function fetchBatchDetail(id: number) {
  return apiFetch('/webhooks/batches/' + id)
}

async function retryBatch(id: number) {
  return apiFetch('/webhooks/batches/' + id + '/retry', { method: 'POST' })
}

async function deleteBatch(id: number) {
  return apiFetch('/webhooks/batches/' + id, { method: 'DELETE' })
}

async function batchDeleteBatches(ids: number[]) {
  return apiFetch('/webhooks/batches/delete', { method: 'POST', body: JSON.stringify({ ids }) })
}

function WebhookStatusBadge({ status }: { status: string }) {
  const text = labelOf(WEBHOOK_STATUS_LABELS, status)
  if (status === 'success') return <span className="badge badge-success flex items-center gap-1"><CheckCircle className="h-3 w-3" />{text}</span>
  if (status === 'failed') return <span className="badge badge-danger flex items-center gap-1"><XCircle className="h-3 w-3" />{text}</span>
  if (status === 'retrying') return <span className="badge badge-warning flex items-center gap-1"><RefreshCw className="h-3 w-3" />{text}</span>
  return <span className="badge badge-muted">{text}</span>
}

function BatchPreview({ batchId }: { batchId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['webhook-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId),
  })

  if (isLoading) return <div className="py-2 text-sm text-slate-400">加载中...</div>
  if (error) return <div className="py-2 text-sm text-red-500">加载失败</div>
  if (!data) return null

  const batch: any = data
  const items: any[] = batch.items || []

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">共 {items.length} 首</span>
        <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{labelOf(WEBHOOK_STATUS_LABELS, batch.status)}</span>
        {batch.response_code && <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">HTTP {batch.response_code}</span>}
      </div>
      {items.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-xs text-slate-600 dark:text-slate-300">
          {items.slice(0, 20).map((item: any) => (
            <li key={item.id} className="flex items-center gap-1.5 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
              <span className="font-medium">{item.track}</span>
              {' - '}
              {item.artist}
            </li>
          ))}
          {items.length > 20 && <li className="pl-4 text-slate-400">...还有 {items.length - 20} 首</li>}
        </ul>
      )}
    </div>
  )
}

function BatchMobileCard({ batch, expanded, selected, selectMode, onToggleExpand, onToggleSelect, onRetry, onDelete, retrying, deleting }: {
  batch: any; expanded: boolean; selected: boolean; selectMode: boolean
  onToggleExpand: () => void; onToggleSelect: () => void
  onRetry: () => void; onDelete: () => void
  retrying: boolean; deleting: boolean
}) {
  return (
    <div
      className="card overflow-hidden active:bg-cyan-50/50 cursor-pointer"
      onClick={e => {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button') || target.closest('input')) return
        if (selectMode) { onToggleSelect(); return }
      }}
    >
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {selectMode && (
            <input
              type="checkbox"
              checked={selected}
              onChange={e => { e.stopPropagation(); onToggleSelect() }}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">#{batch.id}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{labelOf(PLAYLIST_TYPE_LABELS, batch.playlist_type)}</span>
              <WebhookStatusBadge status={batch.status} />
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="rounded-lg bg-cyan-500/10 px-2 py-1 font-medium text-cyan-600 dark:text-cyan-300">重试 {batch.retry_count}/{batch.max_retry_count}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">响应码 {batch.response_code ?? '-'}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={onToggleExpand} className="btn-secondary text-xs">
            {expanded ? '收起' : '预览'}
          </button>
          <button type="button" onClick={onRetry} disabled={retrying} className="btn-primary text-xs">
            {retrying ? '重试中' : '重试'}
          </button>
          <button type="button" onClick={onDelete} disabled={deleting} className="btn-danger text-xs">
            {deleting ? '删除中' : '删除'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 bg-slate-50/70 p-4 dark:bg-slate-950/40">
          <BatchPreview batchId={batch.id} />
        </div>
      )}
    </div>
  )
}

export default function WebhooksPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['webhooks', page],
    queryFn: () => fetchBatches(page),
    placeholderData: (previous: any) => previous,
  })

  const retryMutation = useMutation({
    mutationFn: retryBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-batch'] })
      toast.success('重试请求已提交', 'Webhook 将在后台重新发送')
    },
    onError: (err: Error) => toast.error('重试失败', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook 记录已删除')
      setExpanded(null)
    },
    onError: (err: Error) => toast.error('删除失败', err.message),
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteBatches,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('已删除 ' + (res?.deleted ?? selected.size) + ' 条 Webhook 记录')
      setSelected(new Set())
      setSelectMode(false)
      setExpanded(null)
    },
    onError: (err: Error) => toast.error('批量删除失败', err.message),
  })

  const batches: any[] = (data as any)?.items || []
  const total = Number((data as any)?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
      setExpanded(null)
    }
  }, [page, totalPages])

  const allSelected = useMemo(
    () => batches.length > 0 && selected.size === batches.length,
    [batches, selected],
  )

  const toggleSelected = (id: number) => {
    setSelected((prev: Set<number>) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  const clearSelected = () => { setSelected(new Set()); setSelectMode(false) }
  const enterSelectMode = (id: number) => { setSelectMode(true); setSelected(new Set([id])) }

  if (isLoading) {
    return <div className="p-6 text-slate-500">加载中...</div>
  }

  return (
    <div className="page">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Webhook 记录</h1>
          <p className="page-subtitle mt-1">查看缺失歌曲通知的发送状态、响应码和重试记录。</p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          共 {total} 条，每页 {PAGE_SIZE} 条
          {isFetching && <span className="ml-2 text-cyan-600">刷新中...</span>}
        </div>
      </div>

      <SectionToolbar
        left={
          selectMode ? (
            <>
              <button type="button" onClick={clearSelected} className="btn-secondary text-xs">取消选择</button>
              <span className="text-xs font-medium text-cyan-600">已选 {selected.size} 条</span>
            </>
          ) : null
        }
        right={
          selectMode && selected.size > 0 ? (
            <button
              type="button"
              disabled={batchDeleteMutation.isPending}
              className="btn-danger text-xs"
              onClick={async () => {
                const ok = await confirmDanger(
                  '确定删除选中的 ' + selected.size + ' 条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。',
                  '批量删除 Webhook 记录',
                )
                if (!ok) return
                batchDeleteMutation.mutate(Array.from(selected))
              }}
            >
              {batchDeleteMutation.isPending ? '删除中...' : '删除 ' + selected.size + ' 条'}
            </button>
          ) : !selectMode ? (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400">共 {total} 条</span>
              <button type="button" onClick={() => setSelectMode(true)} className="btn-secondary text-xs">选择</button>
            </>
          ) : null
        }
      />

      <ResponsiveList
        items={batches}
        getKey={(batch: any) => batch.id}
        empty={
          <EmptyState
            icon={Link2}
            title="暂无 Webhook 记录"
            description="当同步出现缺失歌曲并开启 Webhook 后，这里会出现记录。"
            actionTo="/settings/connections"
          />
        }
        renderMobileItem={(batch: any) => (
          <BatchMobileCard
            batch={batch}
            expanded={expanded === batch.id}
            selected={selected.has(batch.id)}
            selectMode={selectMode}
            onToggleExpand={() => setExpanded(expanded === batch.id ? null : batch.id)}
            onToggleSelect={() => {
              if (!selectMode) { enterSelectMode(batch.id); return }
              toggleSelected(batch.id)
            }}
            retrying={retryMutation.isPending}
            deleting={deleteMutation.isPending}
            onRetry={() => retryMutation.mutate(batch.id)}
            onDelete={async () => {
              const ok = await confirmDanger(
                '确定删除这条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。',
                '删除 Webhook 记录',
              )
              if (!ok) return
              deleteMutation.mutate(batch.id)
            }}
          />
        )}
        renderTableHeader={() => (
          <tr>
            <th className="w-10 p-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e: any) => {
                  if (e.target.checked) setSelected(new Set(batches.map((b: any) => b.id)))
                  else clearSelected()
                }}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
            </th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">ID</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">歌单类型</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">状态</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">重试</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">响应码</th>
            <th className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">操作</th>
          </tr>
        )}
        renderTableRow={(batch: any) => (
          <>
            <td className="p-3">
              <input
                type="checkbox"
                checked={selected.has(batch.id)}
                onChange={() => toggleSelected(batch.id)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
            </td>
            <td className="p-3 font-semibold">#{batch.id}</td>
            <td className="p-3 text-xs text-slate-500">{labelOf(PLAYLIST_TYPE_LABELS, batch.playlist_type)}</td>
            <td className="p-3"><WebhookStatusBadge status={batch.status} /></td>
            <td className="p-3 text-xs text-slate-500">{batch.retry_count}/{batch.max_retry_count}</td>
            <td className="p-3 text-xs text-slate-500">{batch.response_code ?? '-'}</td>
            <td className="p-3 text-right">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === batch.id ? null : batch.id)}
                  className="btn-secondary text-xs"
                >
                  {expanded === batch.id ? '收起' : '预览'}
                </button>
                <button
                  type="button"
                  onClick={() => retryMutation.mutate(batch.id)}
                  disabled={retryMutation.isPending}
                  className="btn-primary text-xs"
                >
                  重试
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  className="btn-danger text-xs"
                  onClick={async () => {
                    const ok = await confirmDanger(
                      '确定删除这条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。',
                      '删除 Webhook 记录',
                    )
                    if (!ok) return
                    deleteMutation.mutate(batch.id)
                  }}
                >
                  删除
                </button>
              </div>
            </td>
          </>
        )}
      />

      {expanded !== null && (
        <div className="card card-padding">
          <BatchPreview batchId={expanded} />
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={(next: number) => {
          setPage(next)
          setExpanded(null)
          clearSelected()
        }}
      />
    </div>
  )
}
