import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'

const PAGE_SIZE = 5

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

function statusBadge(status: string) {
  if (status === 'success') return 'badge-success'
  if (status === 'failed') return 'badge-danger'
  if (status === 'retrying') return 'badge-warning'
  return 'badge-muted'
}

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
      <div className="text-xs text-slate-500 dark:text-slate-400">
        共 {items.length} 首 · 状态: {(data as any).status}
        {(data as any).response_code && ` · HTTP ${(data as any).response_code}`}
      </div>

      {items.length > 0 && (
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 max-h-52 overflow-y-auto pr-1">
          {items.slice(0, 20).map((item: any) => (
            <li key={item.id} className="truncate">
              <span className="font-medium">{item.track}</span> — {item.artist}
            </li>
          ))}
          {items.length > 20 && (
            <li className="text-slate-400">...还有 {items.length - 20} 首</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function WebhooksPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['webhooks', page],
    queryFn: () => fetchBatches(page),
    placeholderData: previous => previous,
  })

  const retryMutation = useMutation({
    mutationFn: retryBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-batch'] })
    },
  })

  const batches = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
      setExpanded(null)
    }
  }, [page, totalPages])

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return pages
  }, [page, totalPages])

  const goPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages)
    setPage(safePage)
    setExpanded(null)
  }

  if (isLoading) {
    return <div className="p-6 text-slate-500">加载中...</div>
  }

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Webhook 记录</h1>
          <p className="page-subtitle mt-1">
            查看缺失歌曲通知的发送状态、响应码和重试记录。
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          共 {total} 条 · 每页 {PAGE_SIZE} 条
          {isFetching && <span className="ml-2">刷新中...</span>}
        </div>
      </div>

      <div className="space-y-3">
        {batches.length === 0 && (
          <div className="card card-padding text-center text-sm text-slate-400">
            暂无记录
          </div>
        )}

        {batches.map((b: any) => (
          <div key={b.id} className="card overflow-hidden">
            <div className="p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      #{b.id}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 break-all">
                      {b.playlist_type}
                    </span>
                    <span className={statusBadge(b.status)}>{b.status}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2">
                      <div>重试</div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {b.retry_count}/{b.max_retry_count}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2">
                      <div>响应码</div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {b.response_code ?? '-'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 sm:justify-end">
                  <button
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    {expanded === b.id ? '收起' : '预览'}
                  </button>

                  <button
                    onClick={() => retryMutation.mutate(b.id)}
                    disabled={retryMutation.isPending}
                    className="btn-primary flex-1 sm:flex-none"
                  >
                    重试
                  </button>
                </div>
              </div>
            </div>

            {expanded === b.id && (
              <div className="border-t border-border bg-slate-50/70 dark:bg-slate-950/40 p-4">
                <BatchPreview batchId={b.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="card card-padding flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            第 {page} / {totalPages} 页
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              className="btn-secondary"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
            >
              上一页
            </button>

            {pageNumbers[0] > 1 && (
              <>
                <button
                  onClick={() => goPage(1)}
                  className="h-9 min-w-9 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  1
                </button>
                <span className="text-slate-400">...</span>
              </>
            )}

            {pageNumbers.map(p => (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={
                  p === page
                    ? 'h-9 min-w-9 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white'
                    : 'h-9 min-w-9 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                }
              >
                {p}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                <span className="text-slate-400">...</span>
                <button
                  onClick={() => goPage(totalPages)}
                  className="h-9 min-w-9 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              className="btn-secondary"
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
