import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'
import {
  LayoutDashboard,
  Play,
  ScrollText,
  Link2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Music2,
  Clock,
} from 'lucide-react'

async function fetchDashboard() {
  return apiFetch('/dashboard/summary')
}

/* ---------- 统计卡片（统一） ---------- */
function StatCard({
  label,
  value,
  color = 'text-slate-900 dark:text-slate-50',
  icon: Icon,
}: {
  label: string
  value: number
  color?: string
  icon?: React.ElementType
}) {
  return (
    <div className="card card-padding">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        {Icon && (
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Icon className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Hero 卡片 ---------- */
function HeroCard({ lastRun }: { lastRun?: Record<string, any> }) {
  const statusColor = lastRun?.status === 'success'
    ? 'text-emerald-600'
    : lastRun?.status === 'failed'
    ? 'text-red-500'
    : 'text-slate-400'

  return (
    <div className="card card-padding relative overflow-hidden">
      {/* 背景光斑 */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">SonicAI 控制台</h2>
            <p className="text-xs text-slate-400">音乐推荐引擎</p>
          </div>
        </div>

        {lastRun ? (
          <div className="text-right">
            <div className="text-xs text-slate-400">最近任务</div>
            <div className={`text-sm font-semibold ${statusColor}`}>
              {lastRun.status === 'success' ? '已完成' : lastRun.status === 'failed' ? '已失败' : lastRun.status}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(lastRun.created_at)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">暂无执行记录</div>
        )}
      </div>
    </div>
  )
}

/* ---------- 快捷操作入口 ---------- */
function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to="/jobs" className="btn btn-secondary text-xs flex items-center gap-1.5">
        <Play className="w-3.5 h-3.5" />执行推荐
      </Link>
      <Link to="/history" className="btn btn-secondary text-xs flex items-center gap-1.5">
        <ScrollText className="w-3.5 h-3.5" />推荐历史
      </Link>
      <Link to="/settings" className="btn btn-secondary text-xs flex items-center gap-1.5">
        <LayoutDashboard className="w-3.5 h-3.5" />设置
      </Link>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })

  if (isLoading) return <div className="page text-slate-500">加载中...</div>
  if (error) return <div className="page text-red-500">加载失败</div>

  const d = data || {}

  return (
    <div className="page">
      {/* Hero */}
      <HeroCard lastRun={d.last_run} />

      {/* 核心统计（桌面4列，移动2列） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="总执行次数" value={d.total_runs ?? 0} icon={Play} />
        <StatCard label="生成歌单" value={d.total_playlists ?? 0} icon={Music2} />
        <StatCard label="命中歌曲" value={d.total_matched ?? 0} color="text-emerald-600" icon={TrendingUp} />
        <StatCard
          label="缺失歌曲"
          value={d.total_missing ?? 0}
          color={(d.total_missing ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'}
          icon={TrendingDown}
        />
      </div>

      {/* Webhook 状态（桌面2列） */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Webhook 成功"
          value={d.webhook_success_count ?? 0}
          color="text-emerald-600"
          icon={CheckCircle}
        />
        <StatCard
          label="Webhook 失败"
          value={d.webhook_failed_count ?? 0}
          color={(d.webhook_failed_count ?? 0) > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-50'}
          icon={XCircle}
        />
      </div>

      {/* 缺失歌曲追踪（桌面4列） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="待补库歌曲"
          value={d.missed_tracks_pending ?? 0}
          color={(d.missed_tracks_pending ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-50'}
          icon={AlertTriangle}
        />
        <StatCard
          label="补库后已匹配"
          value={d.missed_tracks_matched ?? 0}
          color="text-emerald-600"
          icon={CheckCircle}
        />
        <StatCard
          label="补库重试失败"
          value={d.missed_tracks_failed ?? 0}
          color={(d.missed_tracks_failed ?? 0) > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-50'}
          icon={XCircle}
        />
        <StatCard
          label="已忽略缺失"
          value={d.missed_tracks_ignored ?? 0}
          color="text-slate-400"
        />
      </div>

      {/* 最近执行 + 快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 最近执行 */}
        {d.last_run && (
          <div className="card card-padding">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />最近执行
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{d.last_run.run_type}</p>
                <p className={`text-xs mt-0.5 ${d.last_run.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {d.last_run.status === 'success' ? '已完成' : d.last_run.status === 'failed' ? '已失败' : d.last_run.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">{formatRelativeTime(d.last_run.created_at)}</p>
                <Link to="/history" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">
                  查看全部 →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 快捷操作入口 */}
        <div className="card card-padding">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">快捷操作</h2>
          <QuickActions />
        </div>
      </div>
    </div>
  )
}