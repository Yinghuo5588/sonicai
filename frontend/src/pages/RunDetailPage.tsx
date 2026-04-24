import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'

async function fetchRunDetail(runId: number) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function fetchRunPlaylists(runId: number) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch(`/api/runs/${runId}/playlists`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

function StatCard({ label, value }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
      <div className={`text-2xl font-bold ${color || 'text-slate-800'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

function runTypeLabel(type: string) {
  return type === 'full' ? '完整推荐' : type === 'similar_tracks' ? '相似曲目' : '相邻艺术家'
}

function statusBadge(status: string) {
  const cls = status === 'success' ? 'bg-green-100 text-green-700'
    : status === 'failed' ? 'bg-red-100 text-red-700'
    : status === 'running' ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

export default function RunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>()
  const rid = Number(run_id)

  const { data: run, isLoading: runLoading, error: runError } = useQuery({
    queryKey: ['run', rid],
    queryFn: () => fetchRunDetail(rid),
  })

  const { data: playlists, isLoading: playlistsLoading, error: playlistsError } = useQuery({
    queryKey: ['run-playlists', rid],
    queryFn: () => fetchRunPlaylists(rid),
    enabled: !!run,
  })

  if (runLoading) return <div className="p-6 text-slate-500">加载中...</div>
  if (runError) return <div className="p-6 text-red-500">加载失败：{(runError as Error).message}</div>
  if (!run) return <div className="p-6 text-slate-500">任务不存在</div>

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link to="/history" className="text-sm text-blue-500 hover:underline">← 推荐历史</Link>
      </div>

      {/* Run header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-slate-800">{runTypeLabel(run.run_type)}</h1>
          {statusBadge(run.status)}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {run.created_at}
          {run.started_at && ` · 开始 ${run.started_at}`}
          {run.finished_at && ` → 完成 ${run.finished_at}`}
        </p>
        {run.error_message && (
          <p className="text-xs text-red-500 mt-2 bg-red-50 rounded p-2">{run.error_message}</p>
        )}
      </div>

      {/* Playlists */}
      <div>
        <h2 className="text-sm font-medium text-slate-600 mb-2">生成歌单</h2>
        {playlistsLoading && <div className="text-sm text-slate-400">加载中...</div>}
        {playlistsError && <div className="text-sm text-red-500">加载失败：{(playlistsError as Error).message}</div>}
        {playlists && playlists.length === 0 && (
          <div className="text-sm text-slate-400 bg-white rounded-lg border border-slate-200 p-4 text-center">
            暂无歌单（可能无可匹配曲目）
          </div>
        )}
        {playlists && playlists.map((pl: any) => (
          <Link
            key={pl.id}
            to={`/history/playlist/${pl.id}`}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 mb-2 hover:bg-slate-50 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">{pl.playlist_name}</span>
                {statusBadge(pl.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {pl.playlist_type === 'similar_tracks' ? '相似曲目' : '相邻艺术家'} ·{' '}
                {pl.navidrome_playlist_id ? '✅ 已创建' : '⚠️ 未创建'}
                {pl.matched_count > 0 && ` · 命中 ${pl.matched_count}`}
                {pl.missing_count > 0 && ` · 缺失 ${pl.missing_count}`}
              </p>
            </div>
            <span className="text-blue-400 text-sm ml-2">查看 →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
