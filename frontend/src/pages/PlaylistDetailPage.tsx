import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import apiFetch from '@/lib/api'

const PAGE_SIZE = 50

type PlaylistInfo = {
  id: number
  run_id?: number
  name: string
  playlist_name?: string
  playlist_type: string
  playlist_date?: string | null
  status: string
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

async function fetchPlaylistItems(
  playlistId: number,
  offset = 0,
): Promise<PlaylistItemsResponse> {
  return apiFetch(
    `/runs/playlists/${playlistId}/items?limit=${PAGE_SIZE}&offset=${offset}`,
  )
}

function Stat({
  label,
  value,
  color = 'text-slate-800',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function playlistTypeLabel(type: string) {
  if (type === 'similar_tracks') return '相似曲目'
  if (type === 'similar_artists') return '相邻艺术家'
  if (type === 'hotboard') return '网易云热榜'
  if (type?.startsWith('playlist_')) return '导入歌单'
  return type || '-'
}

function sourceTypeLabel(type: string) {
  if (type === 'track_similarity') return '相似曲目'
  if (type === 'artist_similarity') return '相似艺术家'
  if (type === 'hotboard') return '热榜'
  if (type === 'playlist') return '歌单'
  return type || '-'
}

function sourceTypeClass(type: string) {
  if (type === 'track_similarity') return 'bg-blue-50 text-blue-600'
  if (type === 'artist_similarity') return 'bg-purple-50 text-purple-600'
  if (type === 'hotboard') return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}

function statusBadgeClass(status: string) {
  if (status === 'success') return 'bg-green-100 text-green-700'
  if (status === 'failed') return 'bg-red-100 text-red-700'
  if (status === 'running') return 'bg-blue-100 text-blue-700'
  if (status === 'pending') return 'bg-slate-100 text-slate-600'
  return 'bg-slate-100 text-slate-600'
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
      const loadedCount = allPages.reduce(
        (sum, page) => sum + (page.items?.length || 0),
        0,
      )
      const total = lastPage.total || 0
      if (loadedCount >= total) {
        return undefined
      }
      return loadedCount
    },
  })

  if (!Number.isFinite(pid) || pid <= 0) {
    return <div className="p-6 text-red-500">歌单 ID 无效</div>
  }

  if (isLoading) {
    return <div className="p-6 text-slate-500">加载中...</div>
  }

  if (isError) {
    return (
      <div className="p-6 text-red-500">
        加载失败：{error instanceof Error ? error.message : '未知错误'}
      </div>
    )
  }

  const firstPage = data?.pages?.[0]

  if (!firstPage) {
    return <div className="p-6 text-red-500">未找到歌单</div>
  }

  const playlist = firstPage.playlist
  const total = firstPage.total || 0
  const items = data.pages.flatMap(page => page.items || [])

  const typeLabel = playlistTypeLabel(playlist.playlist_type)
  const playlistName = playlist.name || playlist.playlist_name || '未命名歌单'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800 truncate">
              {playlistName}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(
                playlist.status,
              )}`}
            >
              {playlist.status}
            </span>
          </div>

          <p className="text-sm text-slate-500 mt-1">
            {typeLabel}
            {playlist.playlist_date ? ` · ${playlist.playlist_date}` : ''}
            {' · '}
            共 {total} 首
          </p>
        </div>

        <div className="flex gap-6 text-sm shrink-0">
          <Stat label="候选" value={playlist.total_candidates || 0} />
          <Stat
            label="命中"
            value={playlist.matched_count || 0}
            color="text-green-600"
          />
          <Stat
            label="缺失"
            value={playlist.missing_count || 0}
            color={
              (playlist.missing_count || 0) > 0 ? 'text-amber-600' : 'text-slate-700'
            }
          />
        </div>
      </div>

      {/* Progress bar */}
      {(playlist.total_candidates || 0) > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((playlist.matched_count || 0) / (playlist.total_candidates || 1)) * 100,
                )}%`,
              }}
            />
          </div>
          <span className="text-sm text-slate-500 w-40">
            {playlist.matched_count || 0}/{playlist.total_candidates || 0} 命中
          </span>
        </div>
      )}

      {/* Back link */}
      <Link
        to={playlist.run_id ? `/history/run/${playlist.run_id}` : '/history'}
        className="text-sm text-blue-500 hover:underline flex items-center gap-1"
      >
        ← 返回历史记录
      </Link>

      {/* Items table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600 w-12">#</th>
              <th className="text-left p-3 font-medium text-slate-600">状态</th>
              <th className="text-left p-3 font-medium text-slate-600">曲目</th>
              <th className="text-left p-3 font-medium text-slate-600">艺术家</th>
              <th className="text-left p-3 font-medium text-slate-600">专辑</th>
              <th className="text-left p-3 font-medium text-slate-600">来源</th>
              <th className="text-left p-3 font-medium text-slate-600">置信度</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-slate-400 text-center"
                >
                  暂无数据
                </td>
              </tr>
            )}

            {items.map(item => (
              <tr
                key={item.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="p-3 text-slate-400 text-xs">
                  {item.rank_index ?? '-'}
                </td>

                <td className="p-3">
                  {item.matched ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      命中
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      缺失
                    </span>
                  )}
                </td>

                <td className="p-3 font-medium text-slate-800">
                  {item.title}
                </td>

                <td className="p-3 text-slate-600">
                  {item.artist}
                </td>

                <td className="p-3 text-slate-400 text-xs">
                  {item.album || '-'}
                </td>

                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${sourceTypeClass(
                      item.source_type,
                    )}`}
                  >
                    {sourceTypeLabel(item.source_type)}
                  </span>
                </td>

                <td className="p-3 text-slate-400 text-xs">
                  {item.confidence_score != null
                    ? `${(Number(item.confidence_score) * 100).toFixed(0)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Load more */}
        {total > PAGE_SIZE && (
          <div className="p-3 text-center border-t border-slate-100">
            {isFetchingNextPage ? (
              <span className="text-sm text-slate-400">加载中...</span>
            ) : hasNextPage ? (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-sm text-blue-500 hover:text-blue-600 font-medium disabled:opacity-50"
              >
                加载更多 ({items.length}/{total})
              </button>
            ) : (
              <span className="text-sm text-slate-400">
                已显示全部 {items.length} 首
              </span>
            )}
          </div>
        )}

        {isFetching && !isFetchingNextPage && (
          <div className="p-2 text-center text-xs text-slate-400 border-t border-slate-100">
            正在刷新...
          </div>
        )}
      </div>
    </div>
  )
}
