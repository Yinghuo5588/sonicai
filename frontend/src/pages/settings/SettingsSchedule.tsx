import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { useToast } from '@/components/ui/useToast'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  Tooltip,
  useSettingsForm,
} from './SettingsShared'
import { CheckCircle, XCircle, Zap } from 'lucide-react'

async function previewPlaylistCleanup() {
  return apiFetch('/tasks/playlist-cleanup/preview', { method: 'POST' })
}

async function runPlaylistCleanup() {
  return apiFetch('/tasks/playlist-cleanup/run', { method: 'POST' })
}

export default function SettingsSchedule() {
  const {
    s,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  return (
    <div className="space-y-4">
      <SectionCard title="Last.fm 推荐歌单定时生成">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          定时基于 Last.fm 听歌数据生成推荐歌单，可选择完整推荐、仅相似曲目或仅相邻艺术家。
        </p>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            启用 Last.fm 推荐定时生成
          </span>
        </label>

        <div className="mb-3">
          <FieldInput
            fieldKey="recommendation_cron_run_type"
            value={s.recommendation_cron_run_type ?? 'full'}
            onChange={v => handleChange('recommendation_cron_run_type', v)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Cron 表达式<Tooltip text="分 时 日 月 周" />
          </label>
          <input
            type="text"
            value={String(s.cron_expression ?? '')}
            onChange={e => handleChange('cron_expression', e.target.value)}
            className="input"
          />
        </div>
      </SectionCard>

      <SectionCard title="网易云热榜定时同步">
        <p className="text-xs text-slate-400 mb-3">定时从网易云抓取热榜并同步到 Navidrome</p>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.hotboard_cron_enabled}
            onChange={e => handleChange('hotboard_cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">启用热榜定时同步</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              value={String(s.hotboard_cron_expression ?? '')}
              onChange={e => handleChange('hotboard_cron_expression', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">抓取数量</label>
            <input
              type="number"
              min={1}
              max={200}
              value={Number(s.hotboard_limit ?? 50)}
              onChange={e => handleChange('hotboard_limit', Number(e.target.value))}
              className="input"
            />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {Math.round((s.hotboard_match_threshold ?? 0.75) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            value={Number((s.hotboard_match_threshold ?? 0.75) * 100)}
            onChange={e => handleChange('hotboard_match_threshold', Number(e.target.value) / 100)}
            className="w-full accent-orange-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="歌单名称（留空自动）"
            value={String(s.hotboard_playlist_name ?? '')}
            onChange={e => handleChange('hotboard_playlist_name', e.target.value)}
            className="input"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!s.hotboard_overwrite}
              onChange={e => handleChange('hotboard_overwrite', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            覆盖同名歌单
          </label>
        </div>
      </SectionCard>

      <SectionCard title="歌单链接定时同步">
        <p className="text-xs text-slate-400 mb-3">监控指定歌单链接，变化时自动增量同步到 Navidrome</p>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.playlist_sync_cron_enabled}
            onChange={e => handleChange('playlist_sync_cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">启用歌单定时同步</span>
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              placeholder="0 */6 * * * (每6小时)"
              value={String(s.playlist_sync_cron_expression ?? '')}
              onChange={e => handleChange('playlist_sync_cron_expression', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单链接</label>
            <input
              type="text"
              placeholder="https://music.163.com/playlist?id=xxx"
              value={String(s.playlist_sync_url ?? '')}
              onChange={e => handleChange('playlist_sync_url', e.target.value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {Math.round((s.playlist_sync_threshold ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={Number((s.playlist_sync_threshold ?? 0.75) * 100)}
                onChange={e => handleChange('playlist_sync_threshold', Number(e.target.value) / 100)}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单名称</label>
              <input
                type="text"
                placeholder="留空自动"
                value={String(s.playlist_sync_name ?? '')}
                onChange={e => handleChange('playlist_sync_name', e.target.value)}
                className="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!s.playlist_sync_overwrite}
              onChange={e => handleChange('playlist_sync_overwrite', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            每次全量覆盖（默认增量追加新歌）
          </label>

          {/* 立即同步按钮 */}
          {s.playlist_sync_cron_enabled && s.playlist_sync_url && (
            <TriggerIncrementalSync />
          )}
        </div>
      </SectionCard>

      <SectionCard title="缺失歌曲定时重试">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          定时重试未命中歌曲。建议在补库后开启,并启用「重试前刷新曲库索引」。
        </p>

        <FieldInput
          fieldKey="missed_track_retry_enabled"
          value={s.missed_track_retry_enabled}
          onChange={v => handleChange('missed_track_retry_enabled', v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              value={String(s.missed_track_retry_cron ?? '0 3 * * *')}
              onChange={e => handleChange('missed_track_retry_cron', e.target.value)}
              className="input"
            />
          </div>
          <FieldInput
            fieldKey="missed_track_retry_limit"
            value={s.missed_track_retry_limit}
            onChange={v => handleChange('missed_track_retry_limit', v)}
          />
        </div>

        <FieldInput
          fieldKey="missed_track_retry_refresh_library"
          value={s.missed_track_retry_refresh_library}
          onChange={v => handleChange('missed_track_retry_refresh_library', v)}
        />

        <FieldInput
          fieldKey="missed_track_retry_mode"
          value={s.missed_track_retry_mode}
          onChange={v => handleChange('missed_track_retry_mode', v)}
        />
      </SectionCard>

      <SectionCard title="歌曲缓存自动刷新">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          控制内存歌曲缓存是否启用，以及是否定时从曲库索引刷新。缓存状态请在「曲库索引」页查看。
        </p>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.song_cache_enabled}
            onChange={e => handleChange('song_cache_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            启用歌曲缓存
          </span>
        </label>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.song_cache_auto_refresh_enabled}
            onChange={e => handleChange('song_cache_auto_refresh_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            启用缓存定时刷新
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            缓存刷新 Cron
          </label>
          <input
            type="text"
            value={String(s.song_cache_refresh_cron ?? '0 4 * * *')}
            onChange={e => handleChange('song_cache_refresh_cron', e.target.value)}
            className="input"
          />
        </div>
      </SectionCard>

      <SectionCard title="任务执行策略">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          控制 SonicAI 后台任务的最大并发数量。当前主要影响手动触发并通过后台任务注册器执行的任务。
          Cron 定时任务仍由调度器直接触发，并通过业务锁避免同类任务并发。后续版本会统一接入任务调度器。
        </p>

        <FieldInput
          fieldKey="max_concurrent_tasks"
          value={s.max_concurrent_tasks}
          onChange={v => handleChange('max_concurrent_tasks', v)}
        />

        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3 text-xs text-blue-700 dark:text-blue-300 mt-3">
          说明：全局并发数并不等于业务互斥。推荐、热榜、歌单同步等任务仍会通过后端业务锁避免同类任务并发。
        </div>
      </SectionCard>

      <PlaylistLifecycleCard
        s={s}
        handleChange={handleChange}
      />

      <SectionCard title="历史记录清理">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          控制 SonicAI 数据库中的推荐历史和 Webhook 记录保留时间。
          这里不会删除 Navidrome 中已经创建的歌单。
          如需清理 Navidrome 歌单，请使用上方「歌单生命周期」。
        </p>

        <FieldInput
          fieldKey="history_cleanup_enabled"
          value={s.history_cleanup_enabled}
          onChange={v => handleChange('history_cleanup_enabled', v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <FieldInput
            fieldKey="run_history_keep_days"
            value={s.run_history_keep_days}
            onChange={v => handleChange('run_history_keep_days', v)}
          />
          <FieldInput
            fieldKey="webhook_history_keep_days"
            value={s.webhook_history_keep_days}
            onChange={v => handleChange('webhook_history_keep_days', v)}
          />
        </div>

        <FieldInput
          fieldKey="keep_failed_history"
          value={s.keep_failed_history}
          onChange={v => handleChange('keep_failed_history', v)}
        />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3 text-xs text-amber-700 dark:text-amber-300 mt-3">
          注意：这里清理的是 SonicAI 的数据库历史记录，不会自动删除 Navidrome 中已生成的歌单。
          如果需要删除 Navidrome 歌单，请在推荐历史详情页手动选择删除。
        </div>
      </SectionCard>

      <SaveBar
        hasChanges={hasChanges}
        isPending={mutation.isPending}
        isSuccess={mutation.isSuccess}
        isError={mutation.isError}
        onSave={save}
      />
    </div>
  )
}

/* 歌单生命周期卡片 - 预览/清理功能完整实现 */
function PlaylistLifecycleCard({
  s,
  handleChange,
}: {
  s: Record<string, any>
  handleChange: (key: string, value: unknown) => void
}) {
  const toast = useToast()
  const [preview, setPreview] = useState<any | null>(null)

  const previewMutation = useMutation({
    mutationFn: previewPlaylistCleanup,
    onSuccess: (data: any) => {
      setPreview(data)
      toast.info('清理预览已生成', `预计清理 ${data?.total ?? 0} 个歌单`)
    },
    onError: (err: any) => {
      toast.error('清理预览失败', err?.detail || err?.message || '未知错误')
    },
  })

  const runMutation = useMutation({
    mutationFn: runPlaylistCleanup,
    onSuccess: (data: any) => {
      toast.success(
        '歌单清理完成',
        `扫描 ${data?.scanned ?? 0} 个，更新 ${data?.updated_local_count ?? 0} 个`
      )
      setPreview(null)
    },
    onError: (err: any) => {
      toast.error('歌单清理失败', err?.detail || err?.message || '未知错误')
    },
  })

  return (
    <SectionCard title="歌单生命周期">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        控制 SonicAI 创建的 Navidrome 歌单保留策略。建议先使用「预览清理」确认范围，
        再执行立即清理或开启自动清理。
      </p>

      <FieldInput
        fieldKey="playlist_cleanup_enabled"
        value={s.playlist_cleanup_enabled}
        onChange={v => handleChange('playlist_cleanup_enabled', v)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldInput
          fieldKey="playlist_cleanup_cron"
          value={s.playlist_cleanup_cron ?? '30 3 * * *'}
          onChange={v => handleChange('playlist_cleanup_cron', v)}
        />

        <FieldInput
          fieldKey="playlist_keep_days"
          value={s.playlist_keep_days}
          onChange={v => handleChange('playlist_keep_days', v)}
        />
      </div>

      <FieldInput
        fieldKey="playlist_cleanup_delete_navidrome"
        value={s.playlist_cleanup_delete_navidrome}
        onChange={v => handleChange('playlist_cleanup_delete_navidrome', v)}
      />

      <FieldInput
        fieldKey="playlist_cleanup_keep_failed"
        value={s.playlist_cleanup_keep_failed}
        onChange={v => handleChange('playlist_cleanup_keep_failed', v)}
      />

      <FieldInput
        fieldKey="playlist_cleanup_keep_recent_success_count"
        value={s.playlist_cleanup_keep_recent_success_count}
        onChange={v => handleChange('playlist_cleanup_keep_recent_success_count', v)}
      />

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3 text-xs text-amber-700 dark:text-amber-300">
        注意：如果开启「同时删除 Navidrome 歌单」，清理时会调用 Navidrome 删除远端歌单。
        建议首次使用前先点击「预览清理」确认列表。
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
        >
          {previewMutation.isPending ? '预览中...' : '预览清理'}
        </button>

        <button
          type="button"
          className="btn-danger"
          disabled={runMutation.isPending}
          onClick={() => {
            const confirmText = s.playlist_cleanup_delete_navidrome
              ? '确定立即清理过期歌单吗？当前设置会同时删除 Navidrome 中的远端歌单。'
              : '确定立即清理过期歌单吗？当前设置不会删除 Navidrome 远端歌单，只会清空 SonicAI 中的歌单 ID。'

            if (!window.confirm(confirmText)) return
            runMutation.mutate()
          }}
        >
          {runMutation.isPending ? '清理中...' : '立即清理'}
        </button>
      </div>

      {preview && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900 p-3 text-sm font-semibold">
            预计清理 {preview.total ?? 0} 个歌单
          </div>

          {preview.by_type && (
            <div className="p-3 flex flex-wrap gap-2 text-xs">
              {Object.entries(preview.by_type).map(([type, count]) => (
                <span key={type} className="badge-muted">
                  {type}：{String(count)}
                </span>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {(preview.items || []).length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                当前没有需要清理的过期歌单。
              </div>
            )}

            {(preview.items || []).map((item: any) => (
              <div key={item.playlist_id} className="p-3 text-sm">
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {item.playlist_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  类型：{item.playlist_type} · 创建：{item.created_at || '-'} · 原因：{item.reason}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Navidrome ID：{item.navidrome_playlist_id || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

/* 立即触发增量同步按钮 */
function TriggerIncrementalSync() {
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: () => apiFetch('/playlist/sync-incremental', { method: 'POST' }),
    onSuccess: (data: any) => {
      toast.success('增量同步已提交', `Run ID: ${data?.run_id ?? '-'}`)
    },
    onError: (err: any) => {
      toast.error('同步失败', err?.detail || err?.message || '未知错误')
    },
  })

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="btn btn-secondary text-xs flex items-center gap-1.5 mt-2"
    >
      {mutation.isPending ? (
        <><Zap className="w-3.5 h-3.5 animate-pulse" />同步中...</>
      ) : mutation.isSuccess ? (
        <><CheckCircle className="w-3.5 h-3.5" />已提交</>
      ) : mutation.isError ? (
        <><XCircle className="w-3.5 h-3.5" />重试</>
      ) : (
        <><Zap className="w-3.5 h-3.5" />立即同步</>
      )}
    </button>
  )
}
