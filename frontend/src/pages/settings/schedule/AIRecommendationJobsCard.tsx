// frontend/src/pages/settings/schedule/AIRecommendationJobsCard.tsx

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle, Pencil, Play, Plus, Trash2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui'
import { formatDateTime } from '@/lib/date'
import { SectionCard } from '../SettingsShared'
import {
  createAIRecommendationJob,
  deleteAIRecommendationJob,
  fetchAIRecommendationJobs,
  runAIRecommendationJob,
  updateAIRecommendationJob,
} from './scheduleApi'
import type {
  AIRecommendationJob,
  AIRecommendationJobPayload,
  AIRecommendationJobsResponse,
} from '@/types/api'

const DEFAULT_FORM: AIRecommendationJobPayload = {
  name: '',
  enabled: false,
  cron_expression: '0 8 * * *',
  prompt: '',
  mode: 'free',
  limit: 30,
  playlist_name: '',
  match_threshold: 0.75,
  overwrite: false,
  use_preference_profile: true,
}

function toForm(job: AIRecommendationJob): AIRecommendationJobPayload {
  return {
    name: job.name || '',
    enabled: !!job.enabled,
    cron_expression: job.cron_expression || '0 8 * * *',
    prompt: job.prompt || '',
    mode: job.mode || 'free',
    limit: job.limit ?? 30,
    playlist_name: job.playlist_name || '',
    match_threshold: Number(job.match_threshold ?? 0.75),
    overwrite: !!job.overwrite,
    use_preference_profile: !!job.use_preference_profile,
  }
}

function normalizePayload(form: AIRecommendationJobPayload): AIRecommendationJobPayload {
  return {
    ...form,
    name: form.name.trim(),
    cron_expression: form.cron_expression.trim(),
    prompt: form.prompt.trim(),
    playlist_name: form.playlist_name?.trim() || null,
    limit: Number(form.limit || 30),
    match_threshold: Number(form.match_threshold || 0.75),
  }
}

export default function AIRecommendationJobsCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { confirmDanger } = useConfirm()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AIRecommendationJobPayload>(DEFAULT_FORM)

  const { data, isLoading } = useQuery<AIRecommendationJobsResponse>({
    queryKey: ['ai-recommendation-jobs'],
    queryFn: fetchAIRecommendationJobs as never,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-recommendation-jobs'] })
    queryClient.invalidateQueries({ queryKey: ['task-status'] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => createAIRecommendationJob(payload as Record<string, unknown>),
    onSuccess: () => {
      toast.success('AI 自动推荐任务已创建')
      setForm(DEFAULT_FORM)
      setEditingId(null)
      invalidate()
    },
    onError: (err: Error) => toast.error('创建失败', err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: unknown }) =>
      updateAIRecommendationJob(id, payload as Record<string, unknown>),
    onSuccess: () => {
      toast.success('AI 自动推荐任务已更新')
      setForm(DEFAULT_FORM)
      setEditingId(null)
      invalidate()
    },
    onError: (err: Error) => toast.error('更新失败', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAIRecommendationJob(id),
    onSuccess: () => {
      toast.success('AI 自动推荐任务已删除')
      invalidate()
    },
    onError: (err: Error) => toast.error('删除失败', err.message),
  })

  const runMutation = useMutation({
    mutationFn: (id: number) => runAIRecommendationJob(id),
    onSuccess: (res: unknown) => {
      const r = res as { run_id?: number }
      toast.success('AI 自动推荐任务已提交', `Run ID: ${r?.run_id ?? '-'}`)
      invalidate()
    },
    onError: (err: Error) => toast.error('执行失败', err.message),
  })

  const canSave =
    form.name.trim().length > 0 &&
    form.cron_expression.trim().split(/\s+/).length === 5 &&
    form.prompt.trim().length > 0 &&
    Number(form.limit) >= 1 &&
    Number(form.limit) <= 200 &&
    Number(form.match_threshold) > 0 &&
    Number(form.match_threshold) <= 1

  const save = () => {
    const payload = normalizePayload(form)
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: payload as unknown as Partial<AIRecommendationJobPayload> })
    } else {
      createMutation.mutate(payload as unknown as Partial<AIRecommendationJobPayload>)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  const jobs = data?.items || []

  return (
    <SectionCard
      title="AI 推荐自动化任务"
      description="创建多个 AI 推荐定时任务。每个任务拥有独立 Prompt、Cron、推荐模式、歌单名和匹配阈值。"
    >
      <div className="rounded-2xl border border-border p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? `编辑任务 #${editingId}` : '新建 AI 自动推荐任务'}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              任务名称
            </label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如: 每日夜晚写代码推荐"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Cron 表达式
            </label>
            <input
              className="input"
              value={form.cron_expression}
              onChange={e => setForm(prev => ({ ...prev, cron_expression: e.target.value }))}
              placeholder="0 8 * * *"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              推荐模式
            </label>
            <select
              className="select"
              value={form.mode}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  mode: e.target.value as AIRecommendationJobPayload['mode'],
                }))
              }
            >
              <option value="free">自由灵感模式</option>
              <option value="favorites">收藏个性化模式</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              推荐数量
            </label>
            <input
              type="number"
              min={1}
              max={200}
              className="input"
              value={Number(form.limit ?? 30)}
              onChange={e => setForm(prev => ({ ...prev, limit: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              匹配阈值
            </label>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.01}
              className="input"
              value={Number(form.match_threshold ?? 0.75)}
              onChange={e =>
                setForm(prev => ({ ...prev, match_threshold: Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              歌单名称，留空自动
            </label>
            <input
              className="input"
              value={form.playlist_name || ''}
              onChange={e => setForm(prev => ({ ...prev, playlist_name: e.target.value }))}
              placeholder="AI - 夜晚写代码"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            推荐 Prompt
          </label>
          <textarea
            className="input min-h-32 resize-y"
            rows={5}
            maxLength={4000}
            value={form.prompt}
            onChange={e => setForm(prev => ({ ...prev, prompt: e.target.value }))}
            placeholder="例如: 推荐 30 首适合晚上写代码听的华语、日语歌曲，氛围安静但不要太困。"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">
            {form.prompt.length}/4000
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!form.enabled}
              onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 accent-cyan-500"
            />
            启用定时任务
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!form.overwrite}
              onChange={e => setForm(prev => ({ ...prev, overwrite: e.target.checked }))}
              className="h-4 w-4 accent-cyan-500"
            />
            覆盖同名歌单
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!form.use_preference_profile}
              onChange={e =>
                setForm(prev => ({ ...prev, use_preference_profile: e.target.checked }))
              }
              className="h-4 w-4 accent-cyan-500"
            />
            使用长期偏好文件
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn-primary"
            disabled={!canSave || createMutation.isPending || updateMutation.isPending}
            onClick={save}
          >
            {editingId ? '保存修改' : '创建任务'}
          </button>

          {editingId && (
            <button type="button" className="btn-secondary" onClick={cancelEdit}>
              取消编辑
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
            加载 AI 自动推荐任务...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
            暂无 AI 自动推荐任务。
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      {job.name}
                    </span>
                    <span className={job.enabled ? 'badge badge-success' : 'badge badge-muted'}>
                      {job.enabled ? '已启用' : '未启用'}
                    </span>
                    <span className="badge badge-muted">
                      {job.mode === 'favorites' ? '收藏个性化' : '自由灵感'}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cron: <span className="font-mono">{job.cron_expression}</span>
                    {' · '}
                    数量: {job.limit ?? 30}
                    {' · '}
                    阈值: {Math.round(Number(job.match_threshold ?? 0.75) * 100)}%
                    {' · '}
                    歌单: {job.playlist_name || '自动生成'}
                  </div>

                  <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {job.prompt}
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div>最后运行: {formatDateTime(job.last_run_at)}</div>
                    <div>更新时间: {formatDateTime(job.updated_at)}</div>
                  </div>

                  {job.last_error && (
                    <div className="mt-2 rounded-xl bg-red-50 p-2 text-xs text-red-500 dark:bg-red-950/40">
                      最近错误: {job.last_error}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={runMutation.isPending}
                    onClick={() => runMutation.mutate(job.id)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    立即运行
                  </button>

                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setEditingId(job.id)
                      setForm(toForm(job))
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </button>

                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      updateMutation.mutate({
                        id: job.id,
                        payload: { enabled: !job.enabled },
                      })
                    }
                  >
                    {job.enabled ? (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        停用
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        启用
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirmDanger(
                        `确定删除 AI 自动推荐任务「${job.name}」吗？`,
                        '删除 AI 自动推荐任务',
                      )
                      if (!ok) return
                      deleteMutation.mutate(job.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
        Cron 表达式统一使用 5 段格式：分 时 日 月 周。保存、启用、停用或删除任务后，后端会重新加载定时任务。
      </div>
    </SectionCard>
  )
}
