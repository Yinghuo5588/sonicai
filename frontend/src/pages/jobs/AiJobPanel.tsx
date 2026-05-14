// frontend/src/pages/jobs/AiJobPanel.tsx

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, CheckCircle, Heart, Sparkles, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import ActionCard from './components/ActionCard'
import PreflightCheck from './components/PreflightCheck'
import RangeSlider from './components/RangeSlider'
import ResultTip from './components/ResultTip'
import { triggerAiJob, type AiRecommendMode } from './jobsApi'
import type { JobPanelProps } from './jobsTypes'

export default function AiJobPanel({ settings, onSubmitted }: JobPanelProps) {
  const toast = useToast()

  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<AiRecommendMode>('free')
  const [limit, setLimit] = useState(30)
  const [thresholdPercent, setThresholdPercent] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [usePreferenceProfile, setUsePreferenceProfile] = useState(true)

  const mutation = useMutation({
    mutationFn: () =>
      triggerAiJob({
        prompt,
        mode,
        limit,
        threshold: thresholdPercent / 100,
        playlistName,
        overwrite,
        usePreferenceProfile,
      }),
    onSuccess: (data: any) => {
      const runId = Number(data?.run_id)
      toast.success('AI 推荐已提交', `Run ID: ${runId || '-'}`)

      if (runId) {
        onSubmitted({
          runId,
          title: 'AI 推荐任务已提交',
          message: '可前往推荐历史查看生成进度。',
        })
      }
    },
    onError: (err: Error) => toast.error('AI 推荐提交失败', err.message),
  })

  const aiEnabled = !!settings?.ai_enabled
  const aiKeyOk = !!settings?.ai_api_key
  const modelOk = !!settings?.ai_model
  const navidromeOk = !!settings?.navidrome_url && !!settings?.navidrome_username
  const favoritesReady = Number((settings as any)?.favorite_tracks_last_sync_at ? 1 : 0) > 0
  const promptOk = prompt.trim().length > 0
  const limitOk = Number(limit) >= 1 && Number(limit) <= 200
  const thresholdOk = thresholdPercent >= 50 && thresholdPercent <= 95

  const canSubmit =
    aiEnabled &&
    aiKeyOk &&
    modelOk &&
    navidromeOk &&
    promptOk &&
    limitOk &&
    thresholdOk

  return (
    <ActionCard
      icon={Bot}
      title="AI 推荐"
      description="输入自然语言需求,由 AI 生成候选歌曲,再匹配并同步到 Navidrome。"
    >
      <div className="space-y-3">
        <PreflightCheck
          items={[
            {
              label: 'AI 推荐已启用',
              ok: aiEnabled,
              hint: aiEnabled ? undefined : '请先在后端配置 ai_enabled',
            },
            {
              label: 'AI API Key',
              ok: aiKeyOk,
            },
            {
              label: `AI 模型${settings?.ai_model ? `: ${settings.ai_model}` : ''}`,
              ok: modelOk,
            },
            {
              label: 'Navidrome 配置',
              ok: navidromeOk,
            },
            {
              label: 'Prompt 不为空',
              ok: promptOk,
            },
            {
              label: `歌曲数量 1-200`,
              ok: limitOk,
            },
          ]}
        />

        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            推荐模式
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('free')}
              className={
                mode === 'free'
                  ? 'rounded-2xl border border-cyan-500 bg-cyan-50 p-3 text-left text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                  : 'rounded-2xl border border-border bg-background p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900'
              }
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                自由灵感模式
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                只根据本次自然语言需求和长期偏好文件生成推荐。
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('favorites')}
              className={
                mode === 'favorites'
                  ? 'rounded-2xl border border-cyan-500 bg-cyan-50 p-3 text-left text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                  : 'rounded-2xl border border-border bg-background p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900'
              }
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Heart className="h-4 w-4" />
                收藏个性化模式
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                基于 Navidrome 收藏歌曲样本推断口味，并避免推荐已收藏歌曲。
              </div>
            </button>
          </div>

          {mode === 'favorites' && (
            <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              个性化模式会使用本地缓存的 Navidrome 收藏歌曲。请先在「设置 → 曲库调试 → 收藏缓存」中同步收藏。
              {favoritesReady ? ' 当前检测到已有收藏同步记录。' : ' 当前未检测到收藏同步记录。'}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            推荐需求 Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="例如: 推荐 30 首适合晚上写代码听的华语、日语歌曲,氛围安静但不要太困。"
            className="input min-h-32 resize-y"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">
            {prompt.length}/4000
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            推荐歌曲数量
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="input"
          />
        </div>

        <RangeSlider
          label="匹配阈值"
          value={thresholdPercent}
          onChange={setThresholdPercent}
        />

        <div>
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            歌单名称,留空则自动生成
          </label>
          <input
            type="text"
            value={playlistName}
            onChange={e => setPlaylistName(e.target.value)}
            placeholder="AI - 夜晚写代码"
            className="input"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={e => setOverwrite(e.target.checked)}
            className="h-4 w-4 rounded accent-cyan-500"
          />
          覆盖同名歌单
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={usePreferenceProfile}
            onChange={e => setUsePreferenceProfile(e.target.checked)}
            className="h-4 w-4 rounded accent-cyan-500"
          />
          使用长期偏好文件
        </label>

        <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
          AI 只负责生成候选歌曲。实际匹配、创建 Navidrome 歌单、缺失歌曲 Webhook 通知仍由 SonicAI 后端统一处理。收藏个性化模式会基于本地缓存的 Navidrome 收藏歌曲生成推荐，并在后端过滤已收藏歌曲。
        </div>

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !canSubmit}
          className="btn-primary w-full"
        >
          {mutation.isPending ? (
            '生成中...'
          ) : mutation.isSuccess ? (
            <>
              <CheckCircle className="h-4 w-4" /> 已提交
            </>
          ) : mutation.isError ? (
            <>
              <XCircle className="h-4 w-4" /> 失败,重试
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" /> 提交 AI 推荐
            </>
          )}
        </button>

        <ResultTip
          isSuccess={mutation.isSuccess}
          isError={mutation.isError}
          error={mutation.error}
        />
      </div>
    </ActionCard>
  )
}