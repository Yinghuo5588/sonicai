import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchBatches() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/webhooks/batches', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

async function fetchBatchDetail(id: number) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/webhooks/batches/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

async function retryBatch(id: number) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/webhooks/batches/${id}/retry`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

function BatchPreview({ batchId }: { batchId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['webhook-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId),
  })

  if (isLoading) return <div className="p-3 text-slate-400 text-xs">加载中...</div>
  if (!data) return null

  return (
    <div className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre">
      <div className="text-slate-400 mb-2">// {data.playlist_type} | run #{data.run_id}</div>
      {data.items && data.items.length > 0
        ? data.items.map((item: any, idx: number) => (
            <div key={idx} className="mb-3 border border-slate-700 rounded p-2">
              <div className="text-yellow-300">#{idx + 1}</div>
              <div>track   : {item.track}</div>
              <div>artist  : {item.artist}</div>
              <div>album   : {item.album}</div>
              <div>text    : {item.text}</div>
              {item.raw_payload_json && (
                <div className="mt-1 text-slate-500">raw    : {item.raw_payload_json}</div>
              )}
            </div>
          ))
        : <div className="text-slate-500">无曲目数据</div>
      }
      {data.payload_json && (
        <div className="mt-3 pt-2 border-t border-slate-700">
          <div className="text-slate-400 mb-1">// payload_json (DB stored)</div>
          <pre className="text-orange-300">{data.payload_json}</pre>
        </div>
      )}
      {data.response_body && (
        <div className="mt-3 pt-2 border-t border-slate-700">
          <div className="text-slate-400 mb-1">// response ({data.response_code})</div>
          <pre className="text-red-300">{data.response_body}</pre>
        </div>
      )}
    </div>
  )
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
              <>
                <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-slate-800">{b.id}</td>
                  <td className="p-3 text-slate-600">{b.playlist_type}</td>
                  <td className="p-3">
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
                  <tr key={`${b.id}-detail`}>
                    <td colSpan={6} className="p-3 bg-slate-50 border-t border-slate-100">
                      <BatchPreview batchId={b.id} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
