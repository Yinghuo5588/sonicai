import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import apiFetch, { type RunDetail } from '@/lib/api'
import type { Playlist } from '@/types/api'
import { formatRelativeTime, formatDateTime } from '@/lib/date'
import {
  ArrowLeft,
  StopCircle,
  CheckCircle,
  XCircle,
  RotateCw,
  Clock,
  Music2,
  ListMusic,
  AlertTriangle,
} from 'lucide-react'
import {
  RUN_TYPE_LABELS,
  PLAYLIST_TYPE_LABELS,
  labelOf,
} from '@/lib/labels'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui'
import { CardSkeleton } from '@/components/ui/Skeleton'

async function fetchRunDetail(runId: number): Promise<RunDetail> {
  return apiFetch(`/runs/${runId}`) as Promise<RunDetail>
}

async function fetchRunPlaylists(runId: number): Promise<Playlist[]> {
  return apiFetch(`/runs/${runId}/playlists`) as Promise<Playlist[]>
}

async function stopJob(runId: number) {
  return apiFetch(`/jobs/${runId}/stop`, { method: 'POST' })
}

async function deleteRun(runId: number, deleteNavidromePlaylist = false) {
  return apiFetch(
    `/runs/${runId}?delete_navidrome_playlist=${deleteNavidromePlaylist}`,
    { method: 'DELETE' },
  )
}

function runTypeLabel(type: string) {
  return labelOf(RUN_TYPE_LABELS, type)
}

function playlistTypeLabel(type: string) {
  return labelOf(PLAYLIST_TYPE_LABELS, type)
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'success') return <span className="badge badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" />完成</span>
  if (status === 'failed') return <span className="badge badge-danger flex items-center gap-1"><XCircle className="w-3 h-3" />失败</span>
  if (status === 'running') return <span className="badge badge-info animate-pulse flex items-center gap-1"><RotateCw className="w-3 h-3" />运行中</span>
  if (status === 'stopped') return <span className="badge badge-warning flex items-center gap-1">已停止</span>
  if (status === 'partial_success') return <span className="badge badge-warning flex items-center gap-1">部分成功</span>
  if (status === 'pending') return <span className="badge badge-muted flex items-center gap-1"><Clock className="w-3 h-3" />等待中</span>
  return <span className="badge badge-muted">{status}</span>
}

/* ---------- 统计卡 ---------- */
function StatCard({ label, value, color = 'text-slate-900 dark:text-slate-50' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card card-padding text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </div>
  )
}

/* ---------- 移动端歌单卡片 ---------- */
function PlaylistCard({ playlist }: { playlist: any }) {
  return (
    <Link
      to={`/history/playlist/${playlist.id}`}
      className="card card-padding flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          playlist.status === 'success' ? 'bg-emerald-500/10' :
          playlist.status === 'failed' ? 'bg-red-500/10' :
          'bg-cyan-500/10'
        }`}>
          {playlist.playlist_type === 'similar_tracks' ? (
            <Music2 className={`w-4 h-4 ${playlist.status === 'success' ? 'text-emerald-600' : 'text-cyan-600'}`} />
          ) : (
            <ListMusic className={`w-4 h-4 ${playlist.status === 'success' ? 'text-emerald-600' : 'text-cyan-600'}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
              {playlist.playlist_name || '未命名歌单'}
            </span>
            <RunStatusBadge status={playlist.status} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {playlistTypeLabel(playlist.playlist_type)}
            {playlist.navidrome_playlist_id ? ' · ✅ 已创建' : ' · ⚠️ 未创建'}
            {playlist.matched_count > 0 && ` · 命中 ${playlist.matched_count}`}
            {playlist.missing_count > 0 && ` · 缺失 ${playlist.missing_count}`}
          </p>
          {playlist.error_message && (
            <p className="text-xs text-red-500 mt-1 truncate">{playlist.error_message}</p>
          )}
        </div>
      </div>
      <span className="text-cyan-600 dark:text-cyan-300 text-sm shrink-0">查看 →</span>
    </Link>
  )
}

/* ---------- 进度条卡片 ---------- */
function ProgressCard({ run }: { run: any }) {
  const progress = run.progress || {}
  const matched = progress.matched ?? 0
  const total = progress.total_candidates ?? 0
  const percent = progress.percent ?? 0

  return (
    <div className="card card-padding space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <RotateCw className="w-4 h-4" />匹配进度
        </span>
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {matched} / {total}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700 rounded-full"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">
        {run.status === 'running' ? '正在匹配中...' :
         run.status === 'success' ? '已完成' :
         run.status === 'failed' ? '匹配失败' :
         run.status === 'stopped' ? '已停止' :
         run.status === 'pending' ? '准备中' : '等待中'}
      </p>
    </div>
  )
}

/* ---------- 头部信息卡 ---------- */
function RunHeaderCard({ run }: { run: any }) {
  return (
    <div className="card card-padding space-y-2 relative overflow-hidden">
      {/* 背景光斑 */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-cyan-600 dark:text-cyan-300" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-50">{runTypeLabel(run.run_type)}</h1>
            <RunStatusBadge status={run.status} />
          </div>
        </div>

        {/* 移动端不显示时间线 */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
          <span>创建 {formatRelativeTime(run.created_at)}</span>
          {run.started_at && <span>· 开始 {formatDateTime(run.started_at)}</span>}
          {run.finished_at && <span>· 完成 {formatDateTime(run.finished_at)}</span>}
        </div>
      </div>

      {/* 移动端简略时间 */}
      <div className="md:hidden text-xs text-slate-400">
        {formatRelativeTime(run.created_at)}
      </div>

      {run.error_message && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 p-3 text-sm text-red-600 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {run.error_message}
        </div>
      )}
    </div>
  )
}

/* ---------- 状态引导卡片 ---------- */
function RunActionHint({ run }: { run: any }) {
  if (run.status === 'running' || run.status === 'pending') {
    return (
      <div className="card card-padding border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
          <RotateCw className="h-4 w-4 animate-spin" />
          任务正在执行
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          页面会自动刷新进度。停止任务后，已经写入的数据不会自动回滚。
        </p>
      </div>
    )
  }

  if (run.status === 'failed') {
    return (
      <div className="card card-padding border-red-500/30 bg-red-50/60 dark:bg-red-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          任务失败
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          建议检查 Last.fm、Navidrome、Playlist API、Webhook 或曲库索引配置。
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Link to="/jobs" className="btn-secondary text-xs">重新执行</Link>
          <Link to="/settings/connections" className="btn-secondary text-xs">检查服务连接</Link>
          <Link to="/settings/library" className="btn-secondary text-xs">查看曲库索引</Link>
        </div>
      </div>
    )
  }

  if (run.status === 'stopped') {
    return (
      <div className="card card-padding border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20">
        <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          任务已停止
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          任务已被手动停止。你可以回到任务执行页重新发起。
        </p>
      </div>
    )
  }

  return null
}

export default function RunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>()
  const rid = Number(run_id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirmDanger, confirmInfo } = useConfirm()
  const [stopping, setStopping] = useState(false)

  const { data: run, isLoading: runLoading, error: runError } = useQuery({
    queryKey: ['run', rid],
    queryFn: () => fetchRunDetail(rid),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'pending' ? 3000 : false
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

  const handleStop = async () => {
    const ok = await confirmDanger('确定停止这个任务吗？停止后，已经写入的数据不会自动回滚。', '停止任务')
    if (!ok) return
    setStopping(true)
    stopMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: (deleteNavidromePlaylist: boolean) => deleteRun(rid, deleteNavidromePlaylist),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      toast.success('推荐历史已删除')
      navigate('/history', { replace: true })
    },
    onError: (err: Error) => {
      toast.error('删除失败', err.message)
    },
  })

  const handleDelete = async () => {
    const ok = await confirmDanger(
      '确定删除这条推荐历史吗？这只会删除 SonicAI 中的历史记录，不会删除 Navidrome 中已创建的歌单。',
      '删除推荐历史',
    )
    if (!ok) return
    const deleteNavidrome = await confirmInfo(
      '是否同时删除 Navidrome 中已创建的歌单？\n\n建议选择「取消」，只删除 SonicAI 历史记录。',
      '是否删除 Navidrome 歌单',
    )
    deleteMutation.mutate(deleteNavidrome)
  }

  if (runLoading) {
    return (
      <div className="page space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/history" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="h-6 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }
  if (runError) return <div className="page text-red-500">加载失败：{(runError as Error).message}</div>
  if (!run) return <div className="page text-slate-500">任务不存在</div>

  return (
    <div className="page">
      {/* 返回 + 操作按钮 */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/history"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />推荐历史
        </Link>
        <div className="flex items-center gap-2">
          {isActiveRun && (
            <button
              onClick={handleStop}
              disabled={stopping || stopMutation.isPending}
              className="btn btn-danger flex items-center gap-1.5"
            >
              {stopping || stopMutation.isPending ? (
                <><RotateCw className="w-4 h-4 animate-spin" />停止中...</>
              ) : (
                <><StopCircle className="w-4 h-4" />停止任务</>
              )}
            </button>
          )}
          {!isActiveRun && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger flex items-center gap-1.5"
            >
              {deleteMutation.isPending ? '删除中...' : '删除历史'}
            </button>
          )}
        </div>
      </div>

      {/* 头部信息 */}
      <RunHeaderCard run={run} />

      {/* 状态引导 */}
      <RunActionHint run={run} />

      {/* 进度条（仅 running 有意义） */}
      {run.progress && <ProgressCard run={run} />}

      {/* 桌面端统计行（移动端从 PlaylistCard 看到统计） */}
      {playlists && playlists.length > 0 && (
        <div className="hidden md:grid grid-cols-3 gap-3">
          <StatCard label="生成歌单" value={playlists.length} />
          <StatCard
            label="命中歌曲"
            value={playlists.reduce((s: number, p: any) => s + (p.matched_count || 0), 0)}
            color="text-emerald-600"
          />
          <StatCard
            label="缺失歌曲"
            value={playlists.reduce((s: number, p: any) => s + (p.missing_count || 0), 0)}
            color="text-amber-600"
          />
        </div>
      )}

      {/* 生成歌单 */}
      <div>
        <h2 className="section-title mb-2">生成歌单</h2>

        {playlistsLoading && <div className="text-sm text-slate-400">加载中...</div>}
        {playlistsError && <div className="text-sm text-red-500">加载失败：{(playlistsError as Error).message}</div>}

        {playlists && playlists.length === 0 && (
          <div className="card card-padding text-center text-sm text-slate-400">
            暂无歌单（可能无可匹配曲目）
          </div>
        )}

        {/* 移动端卡片列表 */}
        <div className="md:hidden space-y-2">
          {playlists?.map((pl: any) => (
            <PlaylistCard key={pl.id} playlist={pl} />
          ))}
        </div>

        {/* 桌面端列表 */}
        <div className="hidden md:block space-y-2">
          {playlists?.map((pl: any) => (
            <Link
              key={pl.id}
              to={`/history/playlist/${pl.id}`}
              className="card card-padding flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/60 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{pl.playlist_name}</span>
                  <RunStatusBadge status={pl.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {playlistTypeLabel(pl.playlist_type)} ·{' '}
                  {pl.navidrome_playlist_id ? '✅ 已创建' : '⚠️ 未创建'}
                  {pl.matched_count > 0 && ` · 命中 ${pl.matched_count}`}
                  {pl.missing_count > 0 && ` · 缺失 ${pl.missing_count}`}
                </p>
                {pl.error_message && (
                  <p className="text-xs text-red-500 mt-1 truncate">{pl.error_message}</p>
                )}
              </div>
              <span className="text-cyan-600 dark:text-cyan-300 text-sm ml-3 shrink-0">查看 →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}