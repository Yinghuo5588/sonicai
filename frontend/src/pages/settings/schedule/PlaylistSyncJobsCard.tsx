// frontend/src/pages/settings/schedule/PlaylistSyncJobsCard.tsx

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Link2, Pencil, Play, Plus, RefreshCcw, Trash2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui'
import { formatDateTime } from '@/lib/date'
import { SectionCard } from '../SettingsShared'
import {
  createPlaylistSyncJob,
  deletePlaylistSyncJob,
  fetchPlaylistSyncJobs,
  resetPlaylistSyncJobHash,
  runPlaylistSyncJob,
  updatePlaylistSyncJob,
} from './scheduleApi'
import type {
  PlaylistSyncJob,
  PlaylistSyncJobPayload,
  PlaylistSyncJobsResponse,
} from '@/types/api'

const DEFAULT_FORM: PlaylistSyncJobPayload = {
  name: '',
  enabled: false,
  cron_expression: '0 */6 * * *',
  url: '',
  match_threshold: 0.75,
  playlist_name: '',
  overwrite: false,
}

function toForm(job: PlaylistSyncJob): PlaylistSyncJobPayload {
  return {
    name: job.name || '',
    enabled: !!job.enabled,
    cron_expression: job.cron_expression || '0 */6 * * *',
    url: job.url || '',
    match_threshold: Number(job.match_threshold ?? 0.75),
    playlist_name: job.playlist_name || '',
    overwrite: !!job.overwrite,
  }
}

function normalizePayload(form: PlaylistSyncJobPayload): PlaylistSyncJobPayload {
  return {
    ...form,
    name: form.name.trim(),
    cron_expression: form.cron_expression.trim(),
    url: form.url.trim(),
    playlist_name: form.playlist_name?.trim() || null,
    match_threshold: Number(form.match_threshold || 0.75),
  }
}

function isUrlValid(url: string) {
  return /^https?:\/\//.test(url.trim())
}

export default function PlaylistSyncJobsCard() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { confirmDanger } = useConfirm()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<PlaylistSyncJobPayload>(DEFAULT_FORM)

  const { data, isLoading } = useQuery<PlaylistSyncJobsResponse>({
    queryKey: ['playlist-sync-jobs'],
    queryFn: fetchPlaylistSyncJobs as never,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['playlist-sync-jobs'] })
    queryClient.invalidateQueries({ queryKey: ['task-status'] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => createPlaylistSyncJob(payload as Record<string, unknown>),
    onSuccess: () => {
      toast.success('歌单同步任务已创建')
      setForm(DEFAULT_FORM)
      setEditingId(null)
      invalidate()
    },
    onError: (err: Error) => toast.error('创建失败', err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: unknown }) =>
      updatePlaylistSyncJob(id, payload as Record<string, unknown>),
    onSuccess: () => {
      toast.success('歌单同步任务已更新')
      setForm(DEFAULT_FORM)
      setEditingId(null)
      invalidate()
    },
    onError: (err: Error) => toast.error('更新失败', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePlaylistSyncJob(id),
    onSuccess: () => {
      toast.success('歌单同步任务已删除')
      invalidate()
    },
    onError: (err: Error) => toast.error('删除失败', err.message),
  })

  const runMutation = useMutation({
    mutationFn: (id: number) => runPlaylistSyncJob(id),
    onSuccess: (res: unknown) => {
      const r = res as { run_id?: number }
      toast.success('歌单同步任务已提交', `Run ID: ${r?.run_id ?? '-'}`)
      invalidate()
    },
    onError: (err: Error) => toast.error('执行失败', err.message),
  })

  const resetHashMutation = useMutation({
    mutationFn: (id: number) => resetPlaylistSyncJobHash(id),
    onSuccess: () => {
      toast.success('增量同步 Hash 已重置')
      invalidate()
    },
    onError: (err: Error) => toast.error('重置失败', err.message),
  })

  const canSave =
    form.name.trim().length > 0 &&
    form.cron_expression.trim().split(/\s+/).length === 5 &&
    isUrlValid(form.url) &&
    Number(form.match_threshold) > 0 &&
    Number(form.match_threshold) <= 1

  const save = () => {
    const payload = normalizePayload(form)
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: payload as unknown as Partial<PlaylistSyncJobPayload> })
    } else {
      createMutation.mutate(payload as unknown as Partial<PlaylistSyncJobPayload>)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
  }

  const jobs = data?.items || []

  return (
    <SectionCard
      title="多歌单链接定时同步"
      description="创建多个第三方歌单链接同步任务。每个任务拥有独立 URL、Cron、歌单名、覆盖策略和增量 Hash。"
    >
      <div className="rounded-2xl border border-border p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? `编辑同步任务 #${editingId}` : '新建歌单同步任务'}
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
              placeholder="例如: 网易云收藏歌单"
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
              placeholder="0 */6 * * *"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              歌单链接
            </label>
            <input
              className="input"
              value={form.url}
              onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://music.163.com/playlist?id=xxx"
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
              Navidrome 歌单名称，留空自动
            </label>
            <input
              className="input"
              value={form.playlist_name || ''}
              onChange={e => setForm(prev => ({ ...prev, playlist_name: e.target.value }))}
              placeholder="留空则从原歌单获取"
            />
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
            启用定时同步
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!form.overwrite}
              onChange={e => setForm(prev => ({ ...prev, overwrite: e.target.checked }))}
              className="h-4 w-4 accent-cyan-500"
            />
            每次全量覆盖，默认增量追加
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
            加载歌单同步任务...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
            暂无歌单同步任务。
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="rounded-2xl border border-border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link2 className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      {job.name}
                    </span>
                    <span className={job.enabled ? 'badge badge-success' : 'badge badge-muted'}>
                      {job.enabled ? '已启用' : '未启用'}
                    </span>
                    <span className={job.overwrite ? 'badge badge-warning' : 'badge badge-info'}>
                      {job.overwrite ? '全量覆盖' : '增量追加'}
                    </span>
                  </div>

                  <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                    {job.url}
                  </div>

                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cron: <span className="font-mono">{job.cron_expression}</span>
                    {' · '}
                    阈值: {Math.round(Number(job.match_threshold ?? 0.75) * 100)}%
                    {' · '}
                    歌单: {job.playlist_name || '自动获取'}
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div>最后运行: {formatDateTime(job.last_run_at)}</div>
                    <div>更新时间: {formatDateTime(job.updated_at)}</div>
                    <div className="sm:col-span-2">
                      Hash: <span className="font-mono">{job.last_hash || '-'}</span>
                    </div>
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
                    立即同步
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
                    className="btn-secondary btn-sm"
                    disabled={resetHashMutation.isPending}
                    onClick={async () => {
                      const ok = await confirmDanger(
                        `确定重置「${job.name}」的增量 Hash 吗？下次同步会重新比较当前歌单内容。`,
                        '重置增量 Hash',
                      )
                      if (!ok) return
                      resetHashMutation.mutate(job.id)
                    }}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    重置 Hash
                  </button>

                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirmDanger(
                        `确定删除歌单同步任务「${job.name}」吗？`,
                        '删除歌单同步任务',
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
        新版多歌单同步不再使用旧的 playlist_sync_url 单配置。每个任务独立保存 URL、Cron、覆盖策略和 last_hash。
      </div>
    </SectionCard>
  )
}
