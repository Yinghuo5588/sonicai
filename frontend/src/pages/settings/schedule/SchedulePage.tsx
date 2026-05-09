import { useState, useEffect } from 'react'
import { Clock, DatabaseZap, History, ListRestart, ListTodo, Music, Radio, ShieldCheck, Sparkles, Save } from 'lucide-react'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useSettingsForm } from '../SettingsShared'
import RecommendationCronCard from './RecommendationCronCard'
import HotboardCronCard from './HotboardCronCard'
import PlaylistSyncCronCard from './PlaylistSyncCronCard'
import MissedRetryCronCard from './MissedRetryCronCard'
import SongCacheCronCard from './SongCacheCronCard'
import TaskConcurrencyCard from './TaskConcurrencyCard'
import PlaylistLifecycleCard from './PlaylistLifecycleCard'
import HistoryCleanupCard from './HistoryCleanupCard'
import BottomSheetToolSelector, { type ToolOption } from '@/components/ui/BottomSheetToolSelector'
import type { ScheduleCardProps } from './scheduleTypes'

const SCHEDULE_OPTIONS: ToolOption[] = [
  { key: 'recommendation',    label: 'Last.fm 推荐定时', description: '定时生成相似曲目和相邻艺术家歌单',   icon: Sparkles },
  { key: 'hotboard',         label: '网易云热榜同步',   description: '定时抓取热榜并同步到 Navidrome',      icon: Radio },
  { key: 'playlist-sync',    label: '歌单链接增量同步', description: '监控歌单链接，变化后追加新歌',        icon: Music },
  { key: 'missed-retry',     label: '缺失歌曲重试',     description: '补库后定时重试未命中歌曲',            icon: ListRestart },
  { key: 'song-cache',       label: '歌曲缓存刷新',     description: '控制本地曲库缓存定时刷新',            icon: DatabaseZap },
  { key: 'concurrency',      label: '任务执行策略',     description: '控制后台任务最大并发数',            icon: ShieldCheck },
  { key: 'playlist-lifecycle', label: '歌单生命周期',  description: '按类型配置歌单保留和删除策略',       icon: ListTodo },
  { key: 'history-cleanup',  label: '历史记录清理',     description: '清理推荐历史和 Webhook 记录',        icon: History },
]

function PanelContent({ panelKey, s, handleChange }: { panelKey: string; s: ScheduleCardProps['s']; handleChange: ScheduleCardProps['handleChange'] }) {
  switch (panelKey) {
    case 'recommendation':    return <RecommendationCronCard    s={s} handleChange={handleChange} />
    case 'hotboard':          return <HotboardCronCard         s={s} handleChange={handleChange} />
    case 'playlist-sync':     return <PlaylistSyncCronCard    s={s} handleChange={handleChange} />
    case 'missed-retry':      return <MissedRetryCronCard     s={s} handleChange={handleChange} />
    case 'song-cache':        return <SongCacheCronCard       s={s} handleChange={handleChange} />
    case 'concurrency':       return <TaskConcurrencyCard     s={s} handleChange={handleChange} />
    case 'playlist-lifecycle': return <PlaylistLifecycleCard  s={s} handleChange={handleChange} />
    case 'history-cleanup':   return <HistoryCleanupCard     s={s} handleChange={handleChange} />
    default: return null
  }
}

export default function SchedulePage() {
  const { s, isLoading, mutation, hasChanges, handleChange, save } = useSettingsForm()
  const [activePanel, setActivePanel] = useState('recommendation')
  const [shownSuccess, setShownSuccess] = useState(false)

  useEffect(() => {
    if (mutation.isSuccess) {
      const timer = setTimeout(() => setShownSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
    setShownSuccess(false)
  }, [mutation.isSuccess])

  if (isLoading) {
    return <div className="space-y-4"><FormSkeleton fields={4} /><FormSkeleton fields={3} /><FormSkeleton fields={4} /></div>
  }

  return (
    <div className="page pb-16">
      <PanelContent panelKey={activePanel} s={s} handleChange={handleChange} />

      <div className="rounded-2xl border border-border bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
          <div>Cron 表达式统一使用 5 段格式：<span className="mx-1 font-mono">分 时 日 月 周</span>。保存配置后，后端会重新加载定时任务。</div>
        </div>
      </div>

      {/* 保存按钮 - 左下角 */}
      <button
        type="button"
        onClick={save}
        disabled={!hasChanges || mutation.isPending}
        onMouseDown={e => e.stopPropagation()}
        className={`fixed bottom-24 left-6 z-[51] flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 md:bottom-8 md:left-8 ${
          hasChanges
            ? mutation.isPending
              ? 'bg-amber-500 text-white animate-pulse'
              : mutation.isError
              ? 'bg-red-500 text-white'
              : 'bg-cyan-500 text-white'
            : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
        }`}
        aria-label="保存配置"
      >
        {shownSuccess ? (
          <span className="text-lg">✓</span>
        ) : (
          <Save className="h-6 w-6" />
        )}
      </button>

      {/* 工具选择 FAB + 面板 */}
      <BottomSheetToolSelector
        options={SCHEDULE_OPTIONS}
        activeKey={activePanel}
        onChange={setActivePanel}
        fabLabel="自动化任务"
      />
    </div>
  )
}