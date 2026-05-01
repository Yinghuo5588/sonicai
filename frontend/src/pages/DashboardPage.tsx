import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import apiFetch from '@/lib/api'
import { formatRelativeTime } from '@/lib/date'
import { CardSkeleton } from '@/components/ui/Skeleton'
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
    <div className="card card-padding relative overflow-hidden waveform-bg">
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

/* ---------- 系统状态栏 ---------- */
function HealthStrip({ d }: { d: any }) {
  const lastStatus = d.last_run?.status

  const items = [
    {
      label: '最近任务',
      value: !d.last_run
        ? '暂无'
        : lastStatus === 'success'
        ? '正常'
        : lastStatus === 'failed'
        ? '异常'
        : lastStatus === 'running'
        ? '运行中'
        : lastStatus,
      tone:
        lastStatus === 'failed'
          ? 'danger'
          : lastStatus === 'running'
          ? 'info'
          : 'success',
    },
    {
      label: 'Webhook',
      value: (d.webhook_failed_count ?? 0) > 0
        ? `${d.webhook_failed_count} 失败`
        : '正常',
      tone: (d.webhook_failed_count ?? 0) > 0 ? 'danger' : 'success',
    },
    {
      label: '缺失歌曲',
      value: (d.missed_tracks_pending ?? 0) > 0
        ? `${d.missed_tracks_pending} 待处理`
        : '正常',
      tone: (d.missed_tracks_pending ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      label: '补库重试',
      value: (d.missed_tracks_failed ?? 0) > 0
        ? `${d.missed_tracks_failed} 失败`
        : '正常',
      tone: (d.missed_tracks_failed ?? 0) > 0 ? 'danger' : 'success',
    },
  ]

  const toneClass: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    info: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300',
  }

  return (
    <div className="card card-padding">
      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">系统状态</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <div
            key={item.label}
            className={`rounded-2xl p-3 ${toneClass[item.tone]}`}
          >
            <div className="text-xs opacity-70">{item.label}</div>
            <div className="mt-1 text-sm font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- 待处理事项 ---------- */
function ActionList({ d }: { d: any }) {
  const actions: {
    title: string
    desc: string
    to: string
    label: string
    tone: 'warning' | 'danger' | 'info'
  }[] = []

  if ((d.missed_tracks_pending ?? 0) > 0) {
    actions.push({
      title: '有缺失歌曲待补库',
      desc: `${d.missed_tracks_pending} 首歌曲等待处理或重试`,
      to: '/settings/library',
      label: '去曲库索引',
      tone: 'warning',
    })
  }

  if ((d.webhook_failed_count ?? 0) > 0) {
    actions.push({
      title: 'Webhook 存在失败记录',
      desc: `${d.webhook_failed_count} 条通知失败或等待重试`,
      to: '/webhooks',
      label: '查看 Webhook',
      tone: 'danger',
    })
  }

  if (d.last_run?.status === 'failed') {
    actions.push({
      title: '最近任务执行失败',
      desc: '建议查看任务详情，并检查 Last.fm、Navidrome 或歌单解析配置',
      to: `/history/run/${d.last_run.id}`,
      label: '查看任务详情',
      tone: 'danger',
    })
  }

  if (actions.length === 0) {
    return (
      <div className="card card-padding">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">待处理事项</h2>
        <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          当前没有待处理事项，系统运行良好。
        </div>
      </div>
    )
  }

  return (
    <div className="card card-padding">
      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">待处理事项</h2>
      <div className="space-y-2">
        {actions.map(item => (
          <Link
            key={item.title}
            to={item.to}
            className="block rounded-2xl border border-border p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {item.title}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {item.desc}
            </div>
            <div className="mt-2 text-xs font-medium text-cyan-600 dark:text-cyan-300">
              {item.label} →
            </div>
          </Link>
        ))}
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

  if (isLoading) {
    return (
      <div className="page space-y-3">
        <div className="card card-padding space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }
  if (error) return <div className="page text-red-500">加载失败</div>

  const d = data || {}

  return (
    <div className="page">
      {/* Hero */}
      <HeroCard lastRun={d.last_run} />

      {/* 系统状态 + 待处理事项 */}
      <HealthStrip d={d} />
      <ActionList d={d} />

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