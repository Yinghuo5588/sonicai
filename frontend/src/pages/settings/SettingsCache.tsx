import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import {
  SaveBar,
  SectionCard,
  Tooltip,
  useSettingsForm,
} from './SettingsShared'

async function fetchCacheStatus() {
  return apiFetch('/cache/status')
}

async function triggerRefresh() {
  return apiFetch('/cache/refresh', { method: 'POST' })
}

function formatPercent(value: number) {
  return `${Math.round((value || 0) * 100)}%`
}

export default function SettingsCache() {
  const queryClient = useQueryClient()

  const {
    s,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['cache-status'],
    queryFn: fetchCacheStatus,
    refetchInterval: 5000,
  })

  const refreshMutation = useMutation({
    mutationFn: triggerRefresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache-status'] })
    },
  })

  if (isLoading) {
    return <div className="p-4 text-slate-500">加载中...</div>
  }

  return (
    <div className="space-y-4">
      <SectionCard title="缓存状态">
        {statusLoading ? (
          <div className="text-sm text-slate-500">加载缓存状态...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">状态</div>
              <div className="text-sm font-semibold mt-1">
                {status?.refreshing
                  ? '刷新中'
                  : status?.ready
                  ? '已就绪'
                  : '未就绪'}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">缓存歌曲</div>
              <div className="text-sm font-semibold mt-1">
                {status?.total_songs ?? 0}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">命中率</div>
              <div className="text-sm font-semibold mt-1">
                {formatPercent(status?.hit_rate ?? 0)}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">刷新次数</div>
              <div className="text-sm font-semibold mt-1">
                {status?.refresh_count ?? 0}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mt-3">
          <div>最后全量刷新：{status?.last_full_refresh || '-'}</div>
          <div>命中：{status?.hits ?? 0}，未命中：{status?.misses ?? 0}，回退：{status?.fallbacks ?? 0}</div>
          {status?.last_error && (
            <div className="text-red-500">最近错误：{status.last_error}</div>
          )}
        </div>

        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending || status?.refreshing}
          className="btn-secondary w-full sm:w-auto mt-3"
        >
          {refreshMutation.isPending || status?.refreshing ? '刷新中...' : '手动刷新缓存'}
        </button>
      </SectionCard>

      <SectionCard title="缓存配置">
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
          <Tooltip text="关闭后匹配会回到原来的 Navidrome 实时搜索模式。" />
        </label>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.song_cache_auto_refresh_enabled}
            onChange={e => handleChange('song_cache_auto_refresh_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            启用自动刷新
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            全量刷新 Cron
            <Tooltip text="默认 0 4 * * *，表示每天凌晨 4 点刷新一次。" />
          </label>
          <input
            type="text"
            value={String(s.song_cache_refresh_cron ?? '0 4 * * *')}
            onChange={e => handleChange('song_cache_refresh_cron', e.target.value)}
            className="input"
          />
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