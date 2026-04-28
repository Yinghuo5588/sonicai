import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import apiFetch from '@/lib/api'
import { formatRelativeTime, formatDateTime } from '@/lib/date'
import clsx from 'clsx'
import { StopCircle } from 'lucide-react'

async function fetchRunDetail(runId: number) {
  return apiFetch(`/runs/${runId}`)
}

async function fetchRunPlaylists(runId: number) {
  return apiFetch(`/runs/${runId}/playlists`)
}

async function stopJob(runId: number) {
  return apiFetch(`/jobs/${runId}/stop`, { method: 'POST' })
}

function StatCard({ label, value, color = 'text-slate-800' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

function runTypeLabel(type: string) {
  return type === 'full' ? '完整推荐' : type === 'similar_tracks' ? '相似曲目' : '相邻艺术家'
}

function statusBadge(status: string) {
  const color = {
    success: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    running: 'bg-blue-100 text-blue-700',
    stopped: 'bg-orange-100 text-orange-700',
  }[status] || 'bg-slate-100 text-slate-600'

  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', color)}>
      {status}
    </span>
  )
}

export default function RunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>()
  const rid = Number(run_id)
  const queryClient = useQueryClient()
  const [stopping, setStopping] = useState(false)

  const { data: run, isLoading: runLoading, error: runError } = useQuery({
    queryKey: ['run', rid],
    queryFn: () => fetchRunDetail(rid),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' ? 3000 : false
    },
  })

  const isActiveRun = run?.status === 'pending' || run?.status === 'running'

  const { data: playlists, isLoading: playlistsLoading, error: playlistsError } = useQuery({
    queryKey: ['run-playlists', rid],
    queryFn: () => fetchRunPlaylists(rid),
    enabled: !!run,
    refetchInterval: isActiveRun ? 3000 : false,
  })

  const stopMutation = useMutation({
    mutationFn: () => stopJob(rid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', rid] })
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      setStopping(false)
    },
    onError: (err: Error) => {
      alert(`停止失败: ${err.message}`)
      setStopping(false)
    },
  })

  const handleStop = () => {
    if (!confirm('确定停止这个任务吗？')) return
    setStopping(true)
    stopMutation.mutate()
  }

  if (runLoading) return <div className="p-6 text-slate-500">加载中...</div>
  if (runError) return <div className="p-6 text-red-500">加载失败：{(runError as Error).message}</div>
  if (!run) return <div className="p-6 text-slate-500">任务不存在</div>

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link to="/history" className="text-sm text-blue-500 hover:underline">← 推荐历史</Link>
        {(run.status === 'pending' || run.status === 'running') && (
          <button
            onClick={handleStop}
            disabled={stopping || stopMutation.isPending}
            className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {stopping || stopMutation.isPending ? '停止中...' : <><StopCircle className="w-4 h-4 inline mr-1" />停止任务</>}
          </button>
        )}
      </div>

      {/* Run header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-slate-800">{runTypeLabel(run.run_type)}</h1>
          {statusBadge(run.status)}
        </div>
        <p className="text-xs text-slate-400 mt-1 space-x-1">
          <span>创建于 {formatRelativeTime(run.created_at)}</span>
          {run.started_at && (
            <span>· 开始于 {formatDateTime(run.started_at)}</span>
          )}
          {run.finished_at && (
            <span>· 完成于 {formatDateTime(run.finished_at)}</span>
          )}
        </p>
        {run.error_message && (
          <p className="text-xs text-red-500 mt-2 bg-red-50 rounded p-2">{run.error_message}</p>
        )}
      </div>

      {/* Progress bar */}
      {run.progress && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">匹配进度</span>
            <span className="text-slate-700">
              {run.progress.matched} / {run.progress.total_candidates}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${run.progress.percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {run.status === 'running' ? '正在匹配中...' : run.status === 'success' ? '已完成' : run.status === 'failed' ? '失败' : run.status === 'stopped' ? '已停止' : '准备中'}
          </p>
        </div>
      )}

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
