// frontend/src/pages/jobs/LastfmJobPanel.tsx

import { useMutation } from '@tanstack/react-query'
import { AudioLines, CheckCircle, Users, XCircle, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import ActionCard from './components/ActionCard'
import ResultTip from './components/ResultTip'
import { triggerLastfmJob } from './jobsApi'
import type { JobPanelProps, LastfmRunType } from './jobsTypes'

function LastfmActionRow({ icon: Icon, title, description, buttonLabel, mutation, onRun }: { icon: React.ElementType; title: string; description: string; buttonLabel: string; mutation: ReturnType<typeof useMutation<any, Error, void>>; onRun: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-slate-50/70 p-3 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
          <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
          <ResultTip isSuccess={mutation.isSuccess} isError={mutation.isError} error={mutation.error} />
        </div>
      </div>
      <button type="button" onClick={onRun} disabled={mutation.isPending} className="btn-primary w-full shrink-0 sm:w-auto">
        {mutation.isPending ? '执行中...' : mutation.isSuccess ? <><CheckCircle className="h-4 w-4" /> 已提交</> : mutation.isError ? <><XCircle className="h-4 w-4" /> 失败，重试</> : buttonLabel}
      </button>
    </div>
  )
}

export default function LastfmJobPanel({ onSubmitted }: JobPanelProps) {
  const toast = useToast()
  const makeMutation = (type: LastfmRunType, title: string) => useMutation({
    mutationFn: () => triggerLastfmJob(type),
    onSuccess: (data: any) => {
      const runId = Number(data?.run_id)
      toast.success('推荐任务已提交', `Run ID: ${runId || '-'}`)
      if (runId) onSubmitted({ runId, title, message: '可前往推荐历史查看执行进度。' })
    },
    onError: (err: Error) => toast.error('推荐任务提交失败', err.message),
  })

  const fullMutation = makeMutation('full', '完整推荐任务已提交')
  const tracksMutation = makeMutation('similar_tracks', '相似曲目任务已提交')
  const artistsMutation = makeMutation('similar_artists', '相邻艺术家任务已提交')

  return (
    <ActionCard icon={Zap} title="Last.fm 推荐" description="基于 Last.fm 听歌数据生成推荐歌单，并同步到 Navidrome。">
      <div className="space-y-2">
        <LastfmActionRow icon={Zap} title="完整推荐" description="同时生成相似曲目和相邻艺术家两个推荐歌单" buttonLabel="执行完整推荐" mutation={fullMutation as any} onRun={() => fullMutation.mutate()} />
        <LastfmActionRow icon={AudioLines} title="相似曲目" description="基于用户常听曲目，生成相似歌曲歌单" buttonLabel="仅生成相似曲目" mutation={tracksMutation as any} onRun={() => tracksMutation.mutate()} />
        <LastfmActionRow icon={Users} title="相邻艺术家" description="基于用户喜爱的艺术家，生成相邻艺术家热门歌曲歌单" buttonLabel="仅生成相邻艺术家" mutation={artistsMutation as any} onRun={() => artistsMutation.mutate()} />
      </div>
    </ActionCard>
  )
}