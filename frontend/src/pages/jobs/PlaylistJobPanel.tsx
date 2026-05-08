// frontend/src/pages/jobs/PlaylistJobPanel.tsx

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Music, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import ActionCard from './components/ActionCard'
import PreflightCheck from './components/PreflightCheck'
import RangeSlider from './components/RangeSlider'
import ResultTip from './components/ResultTip'
import { triggerPlaylistJob } from './jobsApi'
import type { JobPanelProps } from './jobsTypes'

function isPlaylistUrlValid(value: string) {
  return /^https?:\/\//.test(value) && (value.includes('163') || value.includes('qq.com') || value.includes('qishui') || value.includes('douyin.com'))
}

export default function PlaylistJobPanel({ settings, onSubmitted }: JobPanelProps) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [thresholdPercent, setThresholdPercent] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [overwrite, setOverwrite] = useState(false)

  const mutation = useMutation({
    mutationFn: () => triggerPlaylistJob({ url, threshold: thresholdPercent / 100, playlistName, overwrite }),
    onSuccess: (data: any) => {
      const runId = Number(data?.run_id)
      toast.success('歌单同步已提交', `Run ID: ${runId || '-'}`)
      if (runId) onSubmitted({ runId, title: '第三方歌单同步任务已提交', message: '可前往推荐历史查看同步进度。' })
    },
    onError: (err: Error) => toast.error('歌单同步失败', err.message),
  })

  const apiOk = !!settings?.playlist_api_url
  const navidromeOk = !!settings?.navidrome_url && !!settings?.navidrome_username
  const urlOk = isPlaylistUrlValid(url)
  const thresholdOk = thresholdPercent >= 50 && thresholdPercent <= 95

  return (
    <ActionCard icon={Music} title="第三方歌单同步" description="导入网易云、QQ 音乐等平台歌单，匹配后同步到 Navidrome。">
      <div className="space-y-3">
        <PreflightCheck items={[{ label: 'Playlist API 地址', ok: apiOk }, { label: 'Navidrome 配置', ok: navidromeOk }, { label: '歌单链接格式', ok: urlOk, hint: url ? undefined : '请填写歌单链接' }, { label: `匹配阈值 ${thresholdPercent}%`, ok: thresholdOk }]} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">歌单链接</label>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://music.163.com/playlist?id=xxx" className="input" />
        </div>
        <RangeSlider label="匹配阈值" value={thresholdPercent} onChange={setThresholdPercent} />
        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">歌单名称，留空自动</label>
          <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="自动从歌单名获取" className="input" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="h-4 w-4 rounded accent-cyan-500" />
          覆盖同名歌单
        </label>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !apiOk || !navidromeOk || !urlOk || !thresholdOk} className="btn-primary w-full">
          {mutation.isPending ? '解析中...' : mutation.isSuccess ? <><CheckCircle className="h-4 w-4" /> 已提交</> : mutation.isError ? <><XCircle className="h-4 w-4" /> 失败，重试</> : <><Music className="h-4 w-4" /> 解析并同步到 Navidrome</>}
        </button>
        <ResultTip isSuccess={mutation.isSuccess} isError={mutation.isError} error={mutation.error} />
      </div>
    </ActionCard>
  )
}