// frontend/src/pages/settings/schedule/FavoriteTracksCronCard.tsx

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Heart, RefreshCcw, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { SectionCard } from '../SettingsShared'
import type { ScheduleCardProps } from './scheduleTypes'
import { triggerFavoriteTracksSync } from './scheduleApi'
import { formatDateTime } from '@/lib/date'

export default function FavoriteTracksCronCard({ s, handleChange }: ScheduleCardProps) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: triggerFavoriteTracksSync,
    onSuccess: () => {
      toast.success('收藏同步任务已启动', '稍后可在曲库调试中查看同步状态')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-favorites-status'] })
    },
    onError: (err: Error) => toast.error('收藏同步启动失败', err.message),
  })

  return (
    <SectionCard title="Navidrome 收藏歌曲定时同步">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        定时从 Navidrome 拉取 Starred 收藏歌曲，缓存到本地，用于 AI 收藏个性化模式。
      </p>

      <label className="mb-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!s.favorite_tracks_sync_enabled}
          onChange={e => handleChange('favorite_tracks_sync_enabled', e.target.checked)}
          className="h-4 w-4 accent-cyan-500"
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          启用收藏歌曲定时同步
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            Cron 表达式
          </label>
          <input
            type="text"
            value={String(s.favorite_tracks_sync_cron ?? '15 4 * * *')}
            onChange={e => handleChange('favorite_tracks_sync_cron', e.target.value)}
            placeholder="15 4 * * *"
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            AI 收藏样本数量
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={Number(s.ai_favorites_sample_limit ?? 40)}
            onChange={e => handleChange('ai_favorites_sample_limit', Number(e.target.value))}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">最后同步</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {formatDateTime(s.favorite_tracks_last_sync_at)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">同步状态</div>
          <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            <Heart className="h-4 w-4 text-cyan-500" />
            {s.favorite_tracks_sync_enabled ? '已启用' : '未启用'}
          </div>
        </div>
      </div>

      {s.favorite_tracks_last_error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-500 dark:bg-red-950/40">
          最近错误: {s.favorite_tracks_last_error}
        </div>
      )}

      <button
        type="button"
        className="btn-secondary"
        disabled={syncMutation.isPending}
        onClick={() => syncMutation.mutate()}
      >
        {syncMutation.isPending ? (
          <>
            <RefreshCcw className="h-4 w-4 animate-spin" />
            同步启动中...
          </>
        ) : syncMutation.isSuccess ? (
          <>
            <CheckCircle className="h-4 w-4" />
            已提交
          </>
        ) : syncMutation.isError ? (
          <>
            <XCircle className="h-4 w-4" />
            失败，重试
          </>
        ) : (
          <>
            <RefreshCcw className="h-4 w-4" />
            立即同步收藏
          </>
        )}
      </button>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
        Cron 表达式统一使用 5 段格式：分 时 日 月 周。默认 15 4 * * * 表示每天凌晨 4:15 同步收藏歌曲。
      </div>
    </SectionCard>
  )
}