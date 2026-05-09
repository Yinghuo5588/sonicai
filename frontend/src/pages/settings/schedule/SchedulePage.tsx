// frontend/src/pages/settings/schedule/SchedulePage.tsx

import { useState, useEffect, useRef } from 'react'
import { Clock, DatabaseZap, History, ListRestart, ListTodo, Music, Radio, ShieldCheck, Sparkles, X } from 'lucide-react'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { SaveBar, useSettingsForm } from '../SettingsShared'
import CurrentTasksCard from './CurrentTasksCard'
import RecommendationCronCard from './RecommendationCronCard'
import HotboardCronCard from './HotboardCronCard'
import PlaylistSyncCronCard from './PlaylistSyncCronCard'
import MissedRetryCronCard from './MissedRetryCronCard'
import SongCacheCronCard from './SongCacheCronCard'
import TaskConcurrencyCard from './TaskConcurrencyCard'
import PlaylistLifecycleCard from './PlaylistLifecycleCard'
import HistoryCleanupCard from './HistoryCleanupCard'
import type { ScheduleCardProps } from './scheduleTypes'

const SCHEDULE_PANELS: {
  key: string
  title: string
  description: string
  icon: React.ElementType
}[] = [
  { key: 'recommendation',   title: 'Last.fm 推荐定时', description: '定时生成相似曲目和相邻艺术家歌单',   icon: Sparkles },
  { key: 'hotboard',        title: '网易云热榜同步',   description: '定时抓取热榜并同步到 Navidrome',      icon: Radio },
  { key: 'playlist-sync',   title: '歌单链接增量同步', description: '监控歌单链接，变化后追加新歌',        icon: Music },
  { key: 'missed-retry',    title: '缺失歌曲重试',     description: '补库后定时重试未命中歌曲',            icon: ListRestart },
  { key: 'song-cache',      title: '歌曲缓存刷新',     description: '控制本地曲库缓存定时刷新',            icon: DatabaseZap },
  { key: 'concurrency',     title: '任务执行策略',     description: '控制后台任务最大并发数',            icon: ShieldCheck },
  { key: 'playlist-lifecycle', title: '歌单生命周期',  description: '按类型配置歌单保留和删除策略',       icon: ListTodo },
  { key: 'history-cleanup', title: '历史记录清理',     description: '清理推荐历史和 Webhook 记录',        icon: History },
]

const PANEL_ICONS: Record<string, React.ElementType> = Object.fromEntries(
  SCHEDULE_PANELS.map(p => [p.key, p.icon])
)

function PanelContent({ key, s, handleChange }: { key: string; s: ScheduleCardProps['s']; handleChange: ScheduleCardProps['handleChange'] }) {
  console.log('PanelContent key:', key, '| activePanel state:', key)
  return (
    <div className="card card-padding mb-3 text-xs text-slate-400">
      PanelContent received key={key} (type={typeof key})
    </div>
  )
}

export default function SchedulePage() {
  const { s, isLoading, mutation, hasChanges, handleChange, save } = useSettingsForm()
  const [activePanel, setActivePanel] = useState('recommendation')
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!panelOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [panelOpen])

  const currentIcon = PANEL_ICONS[activePanel] ?? Sparkles
  const CurrentIconComp = currentIcon

  if (isLoading) {
    return <div className="space-y-4"><FormSkeleton fields={4} /><FormSkeleton fields={3} /><FormSkeleton fields={4} /></div>
  }

  return (
    <div className="page pb-16">
      {/* DEBUG: remove after fix */}
      <div className="card card-padding mb-3 text-xs text-slate-400">DEBUG: activePanel=<b>{activePanel}</b></div>

      {/* 当前面板内容优先显示 */}
      <PanelContent key={activePanel} s={s} handleChange={handleChange} />

      <div className="rounded-2xl border border-border bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
          <div>Cron 表达式统一使用 5 段格式：<span className="mx-1 font-mono">分 时 日 月 周</span>。保存配置后，后端会重新加载定时任务。</div>
        </div>
      </div>

      <SaveBar hasChanges={hasChanges} isPending={mutation.isPending} isSuccess={mutation.isSuccess} isError={mutation.isError} onSave={save} />

      {/* FAB */}
      <button
        type="button"
        onClick={() => setPanelOpen(v => !v)}
        className="fixed bottom-24 right-6 z-[51] flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        aria-label="打开自动化任务"
      >
        <CurrentIconComp className="h-6 w-6" />
      </button>

      {/* 面板 */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 pb-24 dark:bg-slate-900 md:rounded-2xl md:pb-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">自动化任务</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">选择一个任务类型</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SCHEDULE_PANELS.map(panel => {
                const Icon = panel.icon
                const active = panel.key === activePanel
                return (
                  <button
                    key={panel.key}
                    type="button"
                    onClick={() => {
                      setActivePanel(panel.key)
                      setPanelOpen(false)
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                        : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="mb-2 h-5 w-5" />
                    <div className="text-sm font-semibold">{panel.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {panel.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
