import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

async function triggerJob(type: string) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/jobs/run-${type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed')
  return res.json()
}

export default function JobsPage() {
  const allMutation = useMutation({ mutationFn: () => triggerJob('all') })
  const tracksMutation = useMutation({ mutationFn: () => triggerJob('similar-tracks') })
  const artistsMutation = useMutation({ mutationFn: () => triggerJob('similar-artists') })

  const run = (mutation: any, label: string) => (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="flex-1 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
    >
      {mutation.isPending ? '执行中...' : label}
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
        {allMutation.isSuccess && <p className="text-green-600 text-sm">已提交执行</p>}
      </div>
    </div>
  )
}
