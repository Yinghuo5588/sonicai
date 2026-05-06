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

      <SectionCard title="任务管理">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput
            fieldKey="playlist_keep_days"
            value={s.playlist_keep_days}
            onChange={v => handleChange('playlist_keep_days', v)}
          />
          <FieldInput
            fieldKey="max_concurrent_tasks"
            value={s.max_concurrent_tasks}
            onChange={v => handleChange('max_concurrent_tasks', v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="历史记录清理">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          控制 SonicAI 数据库中的推荐历史和 Webhook 记录保留时间。
          自动清理不会删除 Navidrome 中已经创建的歌单。
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
          注意:这里清理的是 SonicAI 的数据库历史记录,不会自动删除 Navidrome 中已生成的歌单。
          如果需要删除 Navidrome 歌单,请在推荐历史详情页手动选择删除。
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
