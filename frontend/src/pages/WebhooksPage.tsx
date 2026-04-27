import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'

async function fetchBatches() {
  return apiFetch('/webhooks/batches')
}

async function fetchBatchDetail(id: number) {
  return apiFetch(`/webhooks/batches/${id}`)
}

async function retryBatch(id: number) {
  return apiFetch(`/webhooks/batches/${id}/retry`, { method: 'POST' })
}


export default function WebhooksPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['webhooks'], queryFn: fetchBatches })
  const retryMutation = useMutation({ mutationFn: retryBatch, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }) })
  const [expanded, setExpanded] = useState<number | null>(null)

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>

  const batches = data || []

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Webhook 历史</h1>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">ID</th>
              <th className="text-left p-3 font-medium text-slate-600">类型</th>
              <th className="text-left p-3 font-medium text-slate-600">状态</th>
              <th className="text-left p-3 font-medium text-slate-600">重试</th>
              <th className="text-left p-3 font-medium text-slate-600">响应码</th>
              <th className="text-left p-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-slate-400 text-center">暂无记录</td></tr>
            )}
            {batches.map((b: any) => (
              <Fragment key={b.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-slate-800">{b.id}</td>
                  <td className="p-3 text-slate-600">{b.playlist_type}</td>
                  <td className="p-3 text-slate-600">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      b.status === 'success' ? 'bg-green-100 text-green-700' :
                      b.status === 'failed' ? 'bg-red-100 text-red-700' :
                      b.status === 'retrying' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{b.status}</span>
                  </td>
                  <td className="p-3 text-slate-600">{b.retry_count}/{b.max_retry_count}</td>
                  <td className="p-3 text-slate-600">{b.response_code ?? '-'}</td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      className="text-blue-500 text-xs hover:underline"
                    >
                      {expanded === b.id ? '收起' : '预览'}
                    </button>
                    <button
                      onClick={() => retryMutation.mutate(b.id)}
                      disabled={retryMutation.isPending}
                      className="text-blue-500 text-xs hover:underline disabled:opacity-50"
                    >
                      重试
                    </button>
                  </td>
                </tr>
                {expanded === b.id && (
                  <tr>
                    <td colSpan={6} className="p-3 bg-slate-50 border-t border-slate-100">
                      <BatchPreview batchId={b.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
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
      <div className="text-xs text-slate-500">
        共 {items.length} 首 · 状态: {(data as any).status}
        {(data as any).response_code && ` · HTTP ${(data as any).response_code}`}
      </div>
      {items.length > 0 && (
        <ul className="text-xs text-slate-600 space-y-0.5 max-h-40 overflow-y-auto">
          {items.slice(0, 20).map((item: any) => (
            <li key={item.id}>
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
