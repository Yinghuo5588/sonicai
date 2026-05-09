// frontend/src/pages/settings/library/LibraryPage.tsx

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Database, FileSearch, Search, ScrollText, UserCheck, X } from 'lucide-react'
import type { LibraryToolTab } from './libraryTypes'
import LibraryStatusCard from './LibraryStatusCard'
import LibrarySongsCard from './LibrarySongsCard'
import MissedTracksCard from './MissedTracksCard'
import MatchDebugCard from './MatchDebugCard'
import ManualMatchCard from './ManualMatchCard'
import MatchLogsCard from './MatchLogsCard'

const TOOL_TABS: {
  key: LibraryToolTab
  label: string
  description: string
  icon: React.ElementType
}[] = [
  { key: 'status',  label: '状态概览',   description: '查看曲库、缓存和命中率',          icon: Database },
  { key: 'songs',   label: '搜索曲库',    description: '按歌名、艺术家、专辑搜索',         icon: Search },
  { key: 'missed',  label: '未命中歌曲',  description: '查看待补库和可重试歌曲',            icon: AlertTriangle },
  { key: 'match',   label: '匹配诊断',    description: '查看匹配链路和候选结果',            icon: FileSearch },
  { key: 'manual',  label: '人工匹配',    description: '固定错误匹配的对应关系',            icon: UserCheck },
  { key: 'logs',    label: '匹配日志',    description: '排查每次匹配的来源',                icon: ScrollText },
]

const TOOL_ICONS: Record<LibraryToolTab, React.ElementType> = {
  status: Database,
  songs: Search,
  missed: AlertTriangle,
  match: FileSearch,
  manual: UserCheck,
  logs: ScrollText,
}

export default function LibraryPage() {
  const [activeTool, setActiveTool] = useState<LibraryToolTab>('status')
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
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

  const currentIcon = TOOL_ICONS[activeTool]
  const CurrentIconComp = currentIcon

  return (
    <div className="space-y-3 pb-16">
      {/* 当前工具内容 */}
      {activeTool === 'status'  && <LibraryStatusCard />}
      {activeTool === 'songs'   && <LibrarySongsCard />}
      {activeTool === 'missed'  && <MissedTracksCard />}
      {activeTool === 'match'   && <MatchDebugCard />}
      {activeTool === 'manual'  && <ManualMatchCard />}
      {activeTool === 'logs'    && <MatchLogsCard />}

      {/* FAB：当前工具图标 */}
      <button
        type="button"
        onClick={() => setPanelOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        aria-label="打开曲库工具"
      >
        <CurrentIconComp className="h-6 w-6" />
      </button>

      {/* 工具选择面板 */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/40" />

          {/* 面板 */}
          <div
            ref={panelRef}
            className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 dark:bg-slate-900 md:rounded-2xl"
          >
            {/* 标题栏 */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">曲库工具箱</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">选择一个工具</p>
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

            {/* 工具网格 */}
            <div className="grid grid-cols-2 gap-3">
              {TOOL_TABS.map(tool => {
                const Icon = tool.icon
                const active = tool.key === activeTool
                return (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={() => {
                      setActiveTool(tool.key)
                      setPanelOpen(false)
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                        : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="mb-2 h-5 w-5" />
                    <div className="text-sm font-semibold">{tool.label}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {tool.description}
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