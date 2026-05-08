import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import apiFetch from '@/lib/api'
import { ArrowLeft } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import {
  PLAYLIST_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  labelOf,
} from '@/lib/labels'

const PAGE_SIZE = 50

type PlaylistInfo = {
  id: number
  run_id?: number
  name: string
  playlist_name?: string
  playlist_type: string
  playlist_date?: string | null
  status: string
  error_message?: string | null
  matched_count: number
  missing_count: number
  total_candidates: number
  navidrome_playlist_id?: string | null
  created_at?: string | null
}

type PlaylistItem = {
  id: number
  title: string
  artist: string
  album?: string | null
  score?: number | string | null
  source_type: string
  source_seed_name?: string | null
  source_seed_artist?: string | null
  rank_index?: number | null
  navidrome_id?: string | null
  navidrome_title?: string | null
  navidrome_artist?: string | null
  matched: boolean
  confidence_score?: number | string | null
  search_query?: string | null
}

type PlaylistItemsResponse = {
  playlist: PlaylistInfo
  items: PlaylistItem[]
  total: number
}

async function fetchPlaylistItems(playlistId: number, offset = 0): Promise<PlaylistItemsResponse> {
  return apiFetch(`/runs/playlists/${playlistId}/items?limit=${PAGE_SIZE}&offset=${offset}`)
}

function playlistTypeLabel(type: string) {
  return labelOf(PLAYLIST_TYPE_LABELS, type)
}

function sourceTypeLabel(type: string) {
  return labelOf(SOURCE_TYPE_LABELS, type)
}

function sourceTypeClass(type: string) {
  if (type === 'track_similarity') return 'badge-info'
  if (type === 'artist_similarity') return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
  if (type === 'hotboard') return 'badge-danger'
  return 'badge-muted'
}

/* ---------- 共享状态 Badge ---------- */
export function StatusBadge({ status }: { status: string }) {
  if (status === 'success' || status === 'completed') return <span className="badge badge-success">{status}</span>
  if (status === 'failed' || status === 'error') return <span className="badge badge-danger">{status}</span>
  if (status === 'running') return <span className="badge badge-info animate-pulse">{status}</span>
  if (status === 'partial_success') return <span className="badge badge-warning">{status}</span>
  return <span className="badge badge-muted">{status}</span>
}

/* ---------- 移动端歌曲卡片 ---------- */
function TrackCard({ item }: { item: PlaylistItem }) {
  const confidence = item.confidence_score != null ? `${(Number(item.confidence_score) * 100).toFixed(0)}%` : null

  return (
    <div className="card card-padding space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.rank_index != null && (
            <div className="text-[10px] text-slate-400 mb-0.5">#{item.rank_index}</div>
          )}
          <div className="font-semibold text-slate-900 dark:text-slate-50 truncate">{item.title}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{item.artist}{item.album ? ` · ${item.album}` : ''}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.matched ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />命中
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />缺失
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${sourceTypeClass(item.source_type)}`}>{sourceTypeLabel(item.source_type)}</span>
        {confidence && (
          <span className="text-[11px] text-slate-400">置信度 {confidence}</span>
        )}
      </div>
    </div>
  )
}

/* ---------- 移动端顶部统计（3列紧凑） ---------- */
function MobileStats({ playlist }: { playlist: PlaylistInfo }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="card card-padding text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{playlist.total_candidates || 0}</p>
        <p className="text-[10px] text-slate-400">候选</p>
      </div>
      <div className="card card-padding text-center">
        <p className="text-lg font-bold text-emerald-600">{playlist.matched_count || 0}</p>
        <p className="text-[10px] text-slate-400">命中</p>
      </div>
      <div className="card card-padding text-center">
        <p className={`text-lg font-bold ${(playlist.missing_count || 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'}`}>
          {playlist.missing_count || 0}
        </p>
        <p className="text-[10px] text-slate-400">缺失</p>
      </div>
    </div>
  )
}

export default function PlaylistDetailPage() {
  const { playlist_id } = useParams<{ playlist_id: string }>()
  const pid = Number(playlist_id)

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
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
  if (isLoading) return (
    <div className="page space-y-4">
      <div className="h-6 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      <TableSkeleton rows={8} />
    </div>
  )
  if (isError) return <div className="p-6 text-red-500">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>

  const firstPage = data?.pages?.[0]
  if (!firstPage) return <div className="p-6 text-red-500">未找到歌单</div>

  const playlist = firstPage.playlist
  const total = firstPage.total || 0
  const items = data.pages.flatMap(page => page.items || [])
  const playlistName = playlist.name || playlist.playlist_name || '未命名歌单'

  return (
    <div className="page">
      {/* Header */}
      <div className="space-y-3">
        {/* 返回 + 标题行 */}
        <div className="flex items-center gap-2">
          <Link
            to={playlist.run_id ? `/history/run/${playlist.run_id}` : '/history'}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">{playlistName}</h1>
              <StatusBadge status={playlist.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {playlistTypeLabel(playlist.playlist_type)}
              {playlist.playlist_date ? ` · ${playlist.playlist_date}` : ''}
              {' · '}共 {total} 首
            </p>
          </div>
        </div>

        {/* 移动端统计（桌面端隐藏） */}
        <div className="md:hidden">
          <MobileStats playlist={playlist} />
        </div>

        {/* 桌面端统计行（移动端隐藏） */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex gap-6 text-sm">
            <div><span className="text-slate-500">候选</span> <span className="font-bold text-slate-900 dark:text-slate-50">{playlist.total_candidates || 0}</span></div>
            <div><span className="text-slate-500">命中</span> <span className="font-bold text-emerald-600">{playlist.matched_count || 0}</span></div>
            <div><span className="text-slate-500">缺失</span> <span className={`font-bold ${(playlist.missing_count || 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'}`}>{playlist.missing_count || 0}</span></div>
          </div>
        </div>

        {/* 进度条 */}
        {(playlist.total_candidates || 0) > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                style={{ width: `${Math.min(100, ((playlist.matched_count || 0) / (playlist.total_candidates || 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              {playlist.matched_count || 0}/{playlist.total_candidates || 0} 命中
            </span>
          </div>
        )}

        {/* 错误提示 */}
        {playlist.error_message && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 p-3 text-sm text-red-600 dark:text-red-300">
            {playlist.error_message}
          </div>
        )}
      </div>

      {/* 歌曲列表：移动端卡片 / 桌面端表格 */}
      <div className="space-y-3 md:space-y-0 md:block">
        {/* 移动端卡片列表 */}
        <div className="md:hidden space-y-3">
          {items.length === 0 && (
            <div className="card card-padding text-center text-slate-400 text-sm">暂无数据</div>
          )}
          {items.map(item => (
            <TrackCard key={item.id} item={item} />
          ))}
        </div>

        {/* 桌面端表格 */}
        <div className="hidden md:block card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 w-12">#</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">状态</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">曲目</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">艺术家</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">专辑</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">来源</th>
                <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">置信度</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-slate-400 text-center">暂无数据</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-t border-border/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="p-3 text-slate-400 text-xs">{item.rank_index ?? '-'}</td>
                  <td className="p-3">
                    {item.matched ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />命中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />缺失
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-50">{item.title}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{item.artist}</td>
                  <td className="p-3 text-slate-400 text-xs hidden lg:table-cell">{item.album || '-'}</td>
                  <td className="p-3">
                    <span className={`badge ${sourceTypeClass(item.source_type)}`}>{sourceTypeLabel(item.source_type)}</span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">
                    {item.confidence_score != null ? `${(Number(item.confidence_score) * 100).toFixed(0)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 加载更多 */}
      {total > PAGE_SIZE && (
        <div className="text-center py-3">
          {isFetchingNextPage ? (
            <span className="text-sm text-slate-400">加载中...</span>
          ) : hasNextPage ? (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="btn btn-secondary text-sm"
            >
              加载更多 ({items.length}/{total})
            </button>
          ) : (
            <span className="text-sm text-slate-400">已显示全部 {items.length} 首</span>
          )}
        </div>
      )}

      {isFetching && !isFetchingNextPage && (
        <div className="p-2 text-center text-xs text-slate-400">正在刷新...</div>
      )}
    </div>
  )
}