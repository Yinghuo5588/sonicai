import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'

interface PlaylistItem {
  id: number
  rank_index: number
  title: string
  artist: string
  album: string | null
  score: number | null
  source_type: string
  source_seed_name: string | null
  source_seed_artist: string | null
  matched: boolean
  selected_title: string | null
  selected_artist: string | null
  selected_album: string | null
  confidence_score: number | null
  search_query: string | null
}

async function fetchPlaylistItems(playlistId: number, offset = 0) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/runs/playlists/${playlistId}/items?limit=50&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function PlaylistDetailPage() {
  const { playlist_id } = useParams<{ playlist_id: string }>()
  const pid = Number(playlist_id)

  const { data, isLoading } = useQuery({
    queryKey: ['playlist', pid],
    queryFn: () => fetchPlaylistItems(pid),
  })

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>
  if (!data) return <div className="p-6 text-red-500">未找到歌单</div>

  const { playlist, items, total } = data

  const typeLabel = playlist.playlist_type === 'similar_tracks' ? '相似曲目' : '相邻艺术家'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{playlist.playlist_name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              playlist.status === 'success' ? 'bg-green-100 text-green-700' :
              playlist.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {playlist.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {typeLabel} · {playlist.playlist_date} · 共 {total} 首
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="候选" value={playlist.total_candidates} />
          <Stat label="命中" value={playlist.matched_count} color="text-green-600" />
          <Stat label="缺失" value={playlist.missing_count} color={playlist.missing_count > 0 ? 'text-amber-600' : 'text-slate-700'} />
        </div>
      </div>

      {/* Progress bar */}
      {playlist.total_candidates > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(playlist.matched_count / playlist.total_candidates) * 100}%` }}
            />
          </div>
          <span className="text-sm text-slate-500 w-40">
            {playlist.matched_count}/{playlist.total_candidates} 命中
          </span>
        </div>
      )}

      {/* Back link */}
      <Link to="/history" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
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
              <tr><td colSpan={7} className="p-6 text-slate-400 text-center">暂无数据</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 text-slate-400 text-xs">{item.rank_index}</td>
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
                <td className="p-3 font-medium text-slate-800">{item.title}</td>
                <td className="p-3 text-slate-600">{item.artist}</td>
                <td className="p-3 text-slate-400 text-xs">{item.album || '-'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.source_type === 'track_similarity'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-purple-50 text-purple-600'
                  }`}>
                    {item.source_type === 'track_similarity' ? '相似曲目' : '相似艺术家'}
                  </span>
                </td>
                <td className="p-3 text-slate-400 text-xs">
                  {item.confidence_score != null ? `${(item.confidence_score * 100).toFixed(0)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 50 && (
          <div className="p-3 text-center text-sm text-slate-400 border-t border-slate-100">
            共 {total} 首，显示前 {items.length} 首
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-slate-800' }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}