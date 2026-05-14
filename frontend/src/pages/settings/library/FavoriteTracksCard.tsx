// frontend/src/pages/settings/library/FavoriteTracksCard.tsx

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, RefreshCcw, Search } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import { SectionCard } from '../SettingsShared'
import {
  fetchLibraryFavoriteSongs,
  fetchLibraryFavoritesStatus,
  triggerLibraryFavoritesSync,
} from './libraryApi'
import {
  FavoriteTracksResponse,
  LibraryFavoritesStatus,
  LIBRARY_PAGE_SIZE,
} from './libraryTypes'
import PaginationControls from '@/components/ui/PaginationControls'
import { formatDateTime } from '@/lib/date'

export default function FavoriteTracksCard() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data: status } = useQuery<LibraryFavoritesStatus>({
    queryKey: ['library-favorites-status'],
    queryFn: fetchLibraryFavoritesStatus as any,
    refetchInterval: 5000,
  })

  const { data, isLoading } = useQuery<FavoriteTracksResponse>({
    queryKey: ['library-favorite-songs', query, page],
    queryFn: () => fetchLibraryFavoriteSongs(query, page) as any,
  })

  const syncMutation = useMutation({
    mutationFn: triggerLibraryFavoritesSync,
    onSuccess: () => {
      toast.success('收藏同步任务已启动', '稍后会自动刷新收藏缓存状态')
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-favorites-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-favorite-songs'] })
    },
    onError: (err: Error) => toast.error('收藏同步启动失败', err.message),
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(data?.total) || 0) / LIBRARY_PAGE_SIZE)),
    [data],
  )

  const items = data?.items || []

  return (
    <SectionCard
      title="Navidrome 收藏歌曲"
      description="从 Navidrome 拉取已收藏/Starred 歌曲并缓存在本地，用于 AI 个性化推荐。"
      actions={
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="btn-primary"
        >
          <RefreshCcw className="h-4 w-4" />
          {syncMutation.isPending ? '同步启动中...' : '同步收藏'}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">收藏缓存</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {status?.total ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">navidrome_favorite_tracks</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">AI 样本数量</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {status?.ai_sample_limit ?? 40}
          </div>
          <div className="mt-1 text-xs text-slate-400">推荐时使用的收藏样本数</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">定时同步</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {status?.sync_enabled ? '已启用' : '未启用'}
          </div>
          <div className="mt-1 text-xs text-slate-400">{status?.sync_cron || '-'}</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">最后同步</div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {formatDateTime(status?.last_sync_at)}
          </div>
          <div className="mt-1 text-xs text-slate-400">Navidrome Starred</div>
        </div>
      </div>

      {status?.last_error && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-500 dark:bg-red-950/40">
          最近错误: {status.last_error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="搜索收藏歌曲、艺术家或专辑"
            className="input pl-9"
          />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setPage(1)
            queryClient.invalidateQueries({ queryKey: ['library-favorite-songs'] })
          }}
        >
          搜索
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">加载收藏歌曲...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">歌曲</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 md:table-cell">艺术家</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">专辑</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">收藏时间</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center">
                    <EmptyState
                      icon={Heart}
                      title="暂无收藏缓存"
                      description="请先点击同步收藏，从 Navidrome 拉取 Starred 歌曲。"
                    />
                  </td>
                </tr>
              )}

              {items.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{item.title}</div>
                    <div className="text-xs text-slate-400">Navidrome ID: {item.navidrome_id}</div>
                  </td>
                  <td className="hidden p-3 text-slate-600 dark:text-slate-300 md:table-cell">
                    {item.artist || '-'}
                  </td>
                  <td className="hidden p-3 text-slate-400 lg:table-cell">
                    {item.album || '-'}
                  </td>
                  <td className="hidden p-3 text-slate-400 lg:table-cell">
                    {formatDateTime(item.starred_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        current={page}
        total={totalPages}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
      />
    </SectionCard>
  )
}