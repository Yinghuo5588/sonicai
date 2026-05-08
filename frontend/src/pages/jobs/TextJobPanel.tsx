// frontend/src/pages/jobs/TextJobPanel.tsx

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, FileText, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import ActionCard from './components/ActionCard'
import PreflightCheck from './components/PreflightCheck'
import RangeSlider from './components/RangeSlider'
import ResultTip from './components/ResultTip'
import { triggerTextPlaylistJob } from './jobsApi'
import type { JobPanelProps } from './jobsTypes'

export default function TextJobPanel({ settings, onSubmitted }: JobPanelProps) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [thresholdPercent, setThresholdPercent] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [overwrite, setOverwrite] = useState(false)

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('请选择 .txt 文件')
      return triggerTextPlaylistJob({ file, threshold: thresholdPercent / 100, playlistName, overwrite })
    },
    onSuccess: (data: any) => {
      const runId = Number(data?.run_id)
      toast.success('文本歌单同步已提交', `Run ID: ${runId || '-'}`)
      if (runId) onSubmitted({ runId, title: '文本歌单同步任务已提交', message: '可前往推荐历史查看同步进度。' })
    },
    onError: (err: Error) => toast.error('文本歌单同步失败', err.message),
  })

  const navidromeOk = !!settings?.navidrome_url && !!settings?.navidrome_username
  const fileOk = !!file && file.name.toLowerCase().endsWith('.txt')
  const thresholdOk = thresholdPercent >= 50 && thresholdPercent <= 95

  return (
    <ActionCard icon={FileText} title="文本歌单上传" description="上传 .txt 文件，每行格式建议为：歌名 - 艺术家。">
      <div className="space-y-3">
        <PreflightCheck items={[{ label: 'Navidrome 配置', ok: navidromeOk }, { label: '.txt 文件', ok: fileOk, hint: file ? file.name : '请选择文件' }, { label: `匹配阈值 ${thresholdPercent}%`, ok: thresholdOk }]} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">选择 .txt 文件</label>
          <input type="file" accept=".txt" onChange={e => { setFile(e.target.files?.[0] || null); mutation.reset() }} className="input" />
          {file && <p className="mt-1 text-[11px] text-slate-400">已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
        </div>
        <RangeSlider label="匹配阈值" value={thresholdPercent} onChange={setThresholdPercent} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">歌单名称，留空自动</label>
          <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="文本歌单" className="input" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="h-4 w-4 rounded accent-cyan-500" />
          覆盖同名歌单
        </label>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !navidromeOk || !fileOk || !thresholdOk} className="btn-primary w-full">
          {mutation.isPending ? '上传中...' : mutation.isSuccess ? <><CheckCircle className="h-4 w-4" /> 已提交</> : mutation.isError ? <><XCircle className="h-4 w-4" /> 失败，重试</> : <><FileText className="h-4 w-4" /> 上传并同步到 Navidrome</>}
        </button>
        <ResultTip isSuccess={mutation.isSuccess} isError={mutation.isError} error={mutation.error} />
      </div>
    </ActionCard>
  )
}