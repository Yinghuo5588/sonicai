
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Link2 } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import {
  PLAYLIST_TYPE_LABELS,
  WEBHOOK_STATUS_LABELS,
  labelOf,
} from '@/lib/labels'

const PAGE_SIZE = 5

// API 函数
async function fetchBatches(page: number) {
  const offset = (page - 1) * PAGE_SIZE
  return apiFetch(`/webhooks/batches?limit=${PAGE_SIZE}&offset=${offset}`)
}

async function fetchBatchDetail(id: number) {
  return apiFetch(`/webhooks/batches/${id}`)
}

async function retryBatch(id: number) {
  return apiFetch(`/webhooks/batches/${id}/retry`, { method: 'POST' })
}

async function deleteBatch(id: number) {
  return apiFetch(`/webhooks/batches/${id}`, { method: 'DELETE' })
}

async function batchDeleteBatches(ids: number[]) {
  return apiFetch('/webhooks/batches/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

// 辅助组件：状态徽章
function statusBadge(status: string) {
  const text = labelOf(WEBHOOK_STATUS_LABELS, status)
  if (status === 'success') {
    return (
      <span className="badge badge-success flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {text}
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="badge badge-danger flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        {text}
      </span>
    )
  }
  if (status === 'retrying') {
    return (
      <span className="badge badge-warning flex items-center gap-1">
        <RefreshCw className="w-3 h-3" />
        {text}
      </span>
    )
  }
  return <span className="badge badge-muted">{text}</span>
}

// 辅助组件：详情预览
function BatchPreview({ batchId }: { batchId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['webhook-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId),
  })

  if (isLoading) return <div className="text-sm text-slate-400 py-2">加载中...</div>
  if (error) return <div className="text-sm text-red-500 py-2">加载失败</div>
  if (!data) return null

  const items = (data as any).items || []

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">共 {items.length} 首</span>
        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
          {labelOf(WEBHOOK_STATUS_LABELS, (data as any).status)}
        </span>
        {(data as any).response_code && (
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">HTTP {(data as any).response_code}</span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 max-h-48 overflow-y-auto pr-1">
          {items.slice(0, 20).map((item: any) => (
            <li key={item.id} className="truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
              <span className="font-medium">{item.track}</span> — {item.artist}
            </li>
          ))}
          {items.length > 20 && (
            <li className="text-slate-400 pl-4">...还有 {items.length - 20} 首</li>
          )}
        </ul>
      )}
    </div>
  )
}

// 移动端卡片组件
function BatchCard({
  batch,
  expanded,
  onToggle,
  onRetry,
  onDelete,
  onToggleSelect,
  isSelected,
  isRetrying,
  isDeleting,
}: {
  batch: any
  expanded: boolean
  onToggle: () => void
  onRetry: () => void
  onDelete: () => void
  onToggleSelect: () => void
  isSelected: boolean
  isRetrying: boolean
  isDeleting: boolean
}) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4 rounded border-slate-300 text-cyan-600"
            />
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">#{batch.id}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full break-all">
                  {labelOf(PLAYLIST_TYPE_LABELS, batch.playlist_type)}
                </span>
                {statusBadge(batch.status)}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 px-2 py-1 rounded-lg font-medium">
                  重试 {batch.retry_count}/{batch.max_retry_count}
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                  响应码 {batch.response_code ?? '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onToggle} className="btn btn-secondary flex-1 flex items-center justify-center gap-1.5">
            {expanded ? <><ChevronUp className="w-4 h-4" />收起</> : <><ChevronDown className="w-4 h-4" />预览</>}
          </button>
          <button onClick={onRetry} disabled={isRetrying} className="btn btn-primary flex-1 flex items-center justify-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? '重试中' : '重试'}
          </button>
          <button onClick={onDelete} disabled={isDeleting} className="btn btn-danger flex-1 flex items-center justify-center gap-1.5">
            {isDeleting ? '删除中' : '删除'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 bg-slate-50/70 dark:bg-slate-950/40 p-4">
          <BatchPreview batchId={batch.id} />
        </div>
      )}
    </div>
  )
}

// 主页面组件
export default function WebhooksPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // 数据查询 [1]
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['webhooks', page],
    queryFn: () => fetchBatches(page),
    placeholderData: previous => previous,
  })

  // 重试操作
  const retryMutation = useMutation({
    mutationFn: retryBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-batch'] })
      toast.success('重试请求已提交', 'Webhook 将在后台重新发送')
    },
    onError: (error: Error) => toast.error('重试失败', error.message),
  })

  // 删除操作
  const deleteMutation = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook 记录已删除')
      setExpanded(null)
    },
    onError: (error: Error) => toast.error('删除失败', error.message),
  })

  // 批量删除操作 [1]
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteBatches,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(`已删除 ${res.deleted} 条 Webhook 记录`)
      setSelected(new Set())
      setExpanded(null)
    },
    onError: (error: Error) => toast.error('批量删除失败', error.message),
  })

  const batches = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 页面溢出校验
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
      setExpanded(null)
    }
  }, [page, totalPages])

  // 生成页码逻辑 [1]
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [page, totalPages])

  const goPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages)
    setPage(safePage)
    setExpanded(null)
  }

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Webhook 记录</h1>
          <p className="page-subtitle mt-1">查看缺失歌曲通知的发送状态、响应码和重试记录。</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            共 {total} 条 · 每页 {PAGE_SIZE} 条
            {isFetching && <span className="ml-2 text-cyan-600">刷新中...</span>}
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-600 font-medium">已选 {selected.size} 条</span>
              <button
                onClick={() => {
                  if (!confirm(`确定删除选中的 ${selected.size} 条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。`)) return
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
      </div>

      {/* 移动端卡片列表 */}
      <div className="md:hidden space-y-3 mt-4">
        {batches.length === 0 && (
          <EmptyState icon={Link2} title="暂无 Webhook 记录" description="当同步出现缺失歌曲并开启 Webhook 后，这里会出现记录。" actionTo="/settings/connections" />
        )}
        {batches.length > 0 && selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-800 p-3">
            <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">已选 {selected.size} 条</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!confirm(`确定删除选中的 ${selected.size} 条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。`)) return
                  batchDeleteMutation.mutate(Array.from(selected))
                }}
                disabled={batchDeleteMutation.isPending}
                className="btn btn-danger text-xs"
              >
                {batchDeleteMutation.isPending ? '删除中...' : `删除 ${selected.size} 条`}
              </button>
              <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs">取消</button>
            </div>
          </div>
        )}
        {batches.map((b: any) => (
          <BatchCard
            key={b.id}
            batch={b}
            expanded={expanded === b.id}
            onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
            onRetry={() => retryMutation.mutate(b.id)}
            onDelete={() => {
              if (!confirm('确定删除这条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。')) return
              deleteMutation.mutate(b.id)
            }}
            onToggleSelect={() => {
              const next = new Set(selected)
              if (next.has(b.id)) next.delete(b.id)
              else next.add(b.id)
              setSelected(next)
            }}
            isSelected={selected.has(b.id)}
            isRetrying={retryMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        ))}
      </div>

      {/* 桌面端表格 */}
      <div className="hidden md:block space-y-3 mt-4">
        {batches.length === 0 && (
          <EmptyState icon={Link2} title="暂无 Webhook 记录" description="当同步出现缺失歌曲并开启 Webhook 后，这里会出现记录。" />
        )}
        {batches.length > 0 && selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-800 p-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.size === batches.length}
                onChange={e => {
                  if (e.target.checked) setSelected(new Set(batches.map((b: any) => b.id)))
                  else setSelected(new Set())
                }}
                className="w-4 h-4 rounded border-slate-300 text-cyan-600"
              />
              <span className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">已选 {selected.size} 条</span>
            </div>
            <button
              onClick={() => {
                if (!confirm(`确定删除选中的 ${selected.size} 条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。`)) return
                batchDeleteMutation.mutate(Array.from(selected))
              }}
              disabled={batchDeleteMutation.isPending}
              className="btn btn-danger text-xs"
            >
              {batchDeleteMutation.isPending ? '删除中...' : `删除 ${selected.size} 条`}
            </button>
          </div>
        )}
        {batches.map((b: any) => (
          <div key={b.id} className="card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={e => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(b.id)
                      else next.delete(b.id)
                      setSelected(next)
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600"
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">#{b.id}</span>
                      <span className="text-xs text-slate-500">{labelOf(PLAYLIST_TYPE_LABELS, b.playlist_type)}</span>
                      {statusBadge(b.status)}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>重试: {b.retry_count}/{b.max_retry_count}</span>
                      <span>响应码: {b.response_code ?? '-'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="btn-secondary text-xs">
                    {expanded === b.id ? '收起' : '预览'}
                  </button>
                  <button onClick={() => retryMutation.mutate(b.id)} disabled={retryMutation.isPending} className="btn-primary text-xs">重试</button>
                  <button 
                    onClick={() => { if(!confirm('确定删除这条 Webhook 记录吗？这只会删除 SonicAI 中的通知历史，不会影响推荐任务和 Navidrome 歌单。')) return; deleteMutation.mutate(b.id) }} 
                    disabled={deleteMutation.isPending} 
                    className="btn btn-danger text-xs"
                  >
                    删除
                  </button>
                </div>
              </div>
              {expanded === b.id && (
                <div className="mt-4 border-t pt-4">
                  <BatchPreview batchId={b.id} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 分页组件 [1] */}
      {totalPages > 1 && (
        <div className="card card-padding mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500">第 {page} / {totalPages} 页</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button className="btn-secondary" onClick={() => goPage(page - 1)} disabled={page <= 1}>上一页</button>
            {pageNumbers[0] > 1 && (
              <>
                <button onClick={() => goPage(1)} className="h-9 min-w-9 rounded-xl border border-border bg-card text-sm">1</button>
                <span className="text-slate-400">...</span>
              </>
            )}
            {pageNumbers.map(p => (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={p === page 
                  ? 'h-9 min-w-9 rounded-xl bg-cyan-600 px-3 text-sm font-medium text-white' 
                  : 'h-9 min-w-9 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50'}
              >
                {p}
              </button>
            ))}
            <button className="btn-secondary" onClick={() => goPage(page + 1)} disabled={page >= totalPages}>下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
