import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

async function triggerJob(type: string) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/jobs/run-${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function triggerHotboard(limit: number, threshold: number) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/hotboard/sync?limit=${limit}&match_threshold=${threshold}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function JobsPage() {
  const navigate = useNavigate()
  const allMutation = useMutation({ mutationFn: triggerJob })
  const tracksMutation = useMutation({ mutationFn: () => triggerJob('similar-tracks') })
  const artistsMutation = useMutation({ mutationFn: () => triggerJob('similar-artists') })

  const [limit, setLimit] = useState(50)
  const [threshold, setThreshold] = useState(75)
  const hotboardMutation = useMutation({ mutationFn: () => triggerHotboard(limit, threshold / 100) })

  const run = (mutation: ReturnType<typeof useMutation>, label: string, onClick?: () => void) => (
    <button
      onClick={onClick ?? (() => mutation.mutate())}
      disabled={mutation.isPending}
      className="flex-1 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
    >
      {mutation.isPending ? '执行中...' : mutation.isSuccess ? '✅ 已提交' : mutation.isError ? '失败，重试' : label}
    </button>
  )

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">任务执行</h1>
      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">手动执行推荐</h2>
        <div className="flex flex-col gap-2">
          {run(allMutation, '执行全部')}
          {run(tracksMutation, '仅相似曲目')}
          {run(artistsMutation, '仅相邻艺术家')}
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">🌟 网易云热榜同步</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">抓取热榜歌曲数</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">匹配阈值 ({threshold}%)</label>
            <input
              type="range"
              min={50}
              max={95}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
        {run(hotboardMutation, '🌟 网易云热榜同步')}
        {hotboardMutation.isSuccess && (
          <p className="text-green-600 text-sm">✅ 已提交，可在推荐历史查看进度</p>
        )}
        {hotboardMutation.isError && (
          <p className="text-red-500 text-sm">❌ 提交失败：{hotboardMutation.error?.message}</p>
        )}
      </div>
    </div>
  )
}
