// frontend/src/pages/jobs/HotboardJobPanel.tsx

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Star, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import ActionCard from './components/ActionCard'
import PreflightCheck from './components/PreflightCheck'
import RangeSlider from './components/RangeSlider'
import ResultTip from './components/ResultTip'
import { triggerHotboardJob } from './jobsApi'
import type { JobPanelProps } from './jobsTypes'

export default function HotboardJobPanel({ settings, onSubmitted }: JobPanelProps) {
  const toast = useToast()
  const [limit, setLimit] = useState(50)
  const [thresholdPercent, setThresholdPercent] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [overwrite, setOverwrite] = useState(false)

  const mutation = useMutation({
    mutationFn: () => triggerHotboardJob({ limit, threshold: thresholdPercent / 100, playlistName, overwrite }),
    onSuccess: (data: any) => {
      const runId = Number(data?.run_id)
      toast.success('热榜同步已提交', `Run ID: ${runId || '-'}`)
      if (runId) onSubmitted({ runId, title: '热榜同步任务已提交', message: '可前往推荐历史查看同步进度。' })
    },
    onError: (err: Error) => toast.error('热榜同步失败', err.message),
  })

  const navidromeOk = !!settings?.navidrome_url && !!settings?.navidrome_username
  const limitOk = Number(limit) >= 1 && Number(limit) <= 200
  const thresholdOk = thresholdPercent >= 50 && thresholdPercent <= 95

  return (
    <ActionCard icon={Star} title="网易云热榜同步" description="抓取网易云音乐热榜歌曲，匹配后同步到 Navidrome。">
      <div className="space-y-3">
        <PreflightCheck items={[{ label: 'Navidrome 配置', ok: navidromeOk }, { label: `抓取数量 1-200`, ok: limitOk }, { label: `匹配阈值 ${thresholdPercent}%`, ok: thresholdOk }]} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">抓取热榜歌曲数</label>
          <input type="number" min={1} max={200} value={limit} onChange={e => setLimit(Number(e.target.value))} className="input" />
        </div>
        <RangeSlider label="匹配阈值" value={thresholdPercent} onChange={setThresholdPercent} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">歌单名称，留空则自动生成</label>
          <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="网易云热榜 - 2026-04-25" className="input" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="h-4 w-4 rounded accent-cyan-500" />
          覆盖同名歌单
        </label>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !navidromeOk || !limitOk || !thresholdOk} className="btn-primary w-full">
          {mutation.isPending ? '同步中...' : mutation.isSuccess ? <><CheckCircle className="h-4 w-4" /> 已提交</> : mutation.isError ? <><XCircle className="h-4 w-4" /> 失败，重试</> : '同步网易云热榜'}
        </button>
        <ResultTip isSuccess={mutation.isSuccess} isError={mutation.isError} error={mutation.error} />
      </div>
    </ActionCard>
  )
}