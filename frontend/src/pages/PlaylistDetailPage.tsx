// frontend/src/pages/PlaylistDetailPage.tsx

import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import apiFetch from '@/lib/api'
import { labelOf, PLAYLIST_TYPE_LABELS, SOURCE_TYPE_LABELS } from '@/lib/labels'
import { InfoGrid, Progress, ResponsiveList } from '@/components/ui'
import { TableSkeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 50

type PlaylistInfo = {
  id: number; run_id?: number; name: string; playlist_name?: string; playlist_type: string
  playlist_date?: string | null; status: string; error_message?: string | null
  matched_count: number; missing_count: number; total_candidates: number
  navidrome_playlist_id?: string | null; created_at?: string | null
}

type PlaylistItem = {
  id: number; title: string; artist: string; album?: string | null; score?: number | string | null
  source_type: string; source_seed_name?: string | null; source_seed_artist?: string | null
  rank_index?: number | null; navidrome_id?: string | null; navidrome_title?: string | null
  navidrome_artist?: string | null; matched: boolean; confidence_score?: number | string | null; search_query?: string | null
}

type PlaylistItemsResponse = { playlist: PlaylistInfo; items: PlaylistItem[]; total: number }

async function fetchPlaylistItems(playlistId: number, offset = 0): Promise<PlaylistItemsResponse> {
  return apiFetch(`/runs/playlists/${playlistId}/items?limit=${PAGE_SIZE}&offset=${offset}`)
}

function sourceTypeClass(type: string) {
  if (type === 'track_similarity') return 'badge-info'
  if (type === 'artist_similarity') return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
  if (type === 'hotboard') return 'badge-danger'
  if (type === 'ai') return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300'
  return 'badge-muted'
}

function TrackCard({ item }: { item: PlaylistItem }) {
  const confidence = item.confidence_score != null ? `${(Number(item.confidence_score) * 100).toFixed(0)}%` : null
  return (
    <div className="card card-padding space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.rank_index != null && <div className="mb-0.5 text-[10px] text-slate-400">#{item.rank_index}</div>}
          <div className="truncate font-semibold text-slate-900 dark:text-slate-50">{item.title}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{item.artist}{item.album ? ` · ${item.album}` : ''}</div>
          {item.navidrome_id && <div className="mt-1 truncate text-[10px] text-slate-400">Navidrome ID: {item.navidrome_id}</div>}
        </div>
        <div className="shrink-0">
          {item.matched
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />命中</span>
            : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />缺失</span>
          }
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${sourceTypeClass(item.source_type)}`}>{labelOf(SOURCE_TYPE_LABELS, item.source_type)}</span>
        {confidence && <span className="text-[11px] text-slate-400">置信度 {confidence}</span>}
      </div>
    </div>
  )
}

export default function PlaylistDetailPage() {
  const { playlist_id } = useParams<{ playlist_id: string }>()
  const pid = Number(playlist_id)

  const { data, isLoading, isError, error, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['playlist-items', pid],
    enabled: Number.isFinite(pid) && pid > 0,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPlaylistItems(pid, Number(pageParam)),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + (page.items?.length || 0), 0)
      const total = lastPage.total || 0
      if (loadedCount >= total) return undefined
      return loadedCount
    },
  })

  if (!Number.isFinite(pid) || pid <= 0) return <div className="p-6 text-red-500">歌单 ID 无效</div>
  if (isLoading) return <div className="page space-y-4"><div className="h-6 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" /><TableSkeleton rows={8} /></div>
  if (isError) return <div className="p-6 text-red-500">加载失败: {error instanceof Error ? error.message : '未知错误'}</div>

  const firstPage = data?.pages?.[0]
  if (!firstPage) return <div className="p-6 text-red-500">未找到歌单</div>

  const playlist = firstPage.playlist
  const total = firstPage.total || 0
  const items = data.pages.flatMap(page => page.items || [])
  const playlistName = playlist.name || playlist.playlist_name || '未命名歌单'
  const matched = playlist.matched_count || 0
  const totalCandidates = playlist.total_candidates || 0

  return (
    <div className="page">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Link to={playlist.run_id ? `/history/run/${playlist.run_id}` : '/history'} className="-ml-2 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{playlistName}</h1>
              <span className="badge badge-muted">{labelOf(PLAYLIST_TYPE_LABELS, playlist.playlist_type)}</span>
              {playlist.status === 'success' || playlist.status === 'completed' ? <span className="badge badge-success">完成</span>
               : playlist.status === 'failed' ? <span className="badge badge-danger">失败</span>
               : playlist.status === 'running' ? <span className="badge badge-info animate-pulse">运行中</span>
               : <span className="badge badge-muted">{playlist.status}</span>}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{labelOf(PLAYLIST_TYPE_LABELS, playlist.playlist_type)}{playlist.playlist_date ? ` · ${playlist.playlist_date}` : ''} · 共 {total} 首</p>
          </div>
        </div>

        <InfoGrid columns={3} items={[
          { label: '候选', value: totalCandidates },
          { label: '命中', value: matched, tone: 'success' },
          { label: '缺失', value: playlist.missing_count || 0, tone: (playlist.missing_count || 0) > 0 ? 'warning' : 'default' },
        ]} />

        {totalCandidates > 0 && <Progress label="命中进度" value={matched} max={totalCandidates} showValue />}

        {playlist.error_message && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{playlist.error_message}</div>
        )}
      </div>

      <ResponsiveList
        items={items}
        getKey={item => item.id}
        empty={<div className="card card-padding text-center text-sm text-slate-400">暂无数据</div>}
        renderMobileItem={item => <TrackCard item={item} />}
        renderTableHeader={() => (
          <tr>
            <th className="w-12 p-3 text-left font-medium text-slate-600 dark:text-slate-300">#</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">状态</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">曲目</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">艺术家</th>
            <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">专辑</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">来源</th>
            <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">置信度</th>
          </tr>
        )}
        renderTableRow={item => (
          <>
            <td className="p-3 text-xs text-slate-400">{item.rank_index ?? '-'}</td>
            <td className="p-3">
              {item.matched
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />命中</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><span className="h-2 w-2 rounded-full bg-amber-500" />缺失</span>
              }
            </td>
            <td className="p-3 font-medium text-slate-900 dark:text-slate-50">{item.title}</td>
            <td className="p-3 text-slate-600 dark:text-slate-300">{item.artist}</td>
            <td className="hidden p-3 text-xs text-slate-400 lg:table-cell">{item.album || '-'}</td>
            <td className="p-3"><span className={`badge ${sourceTypeClass(item.source_type)}`}>{labelOf(SOURCE_TYPE_LABELS, item.source_type)}</span></td>
            <td className="p-3 text-xs text-slate-400">{item.confidence_score != null ? `${(Number(item.confidence_score) * 100).toFixed(0)}%` : '-'}</td>
          </>
        )}
      />

      {total > PAGE_SIZE && (
        <div className="py-3 text-center">
          {isFetchingNextPage ? <span className="text-sm text-slate-400">加载中...</span>
           : hasNextPage ? <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary text-sm">加载更多 ({items.length}/{total})</button>
           : <span className="text-sm text-slate-400">已显示全部 {items.length} 首</span>}
        </div>
      )}
      {isFetching && !isFetchingNextPage && <div className="p-2 text-center text-xs text-slate-400">正在刷新...</div>}
    </div>
  )
}