// frontend/src/pages/jobs/JobsPage.tsx

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Music, Sparkles, Star, X } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { fetchSettings } from './jobsApi'
import type { JobPanel, SubmittedRun } from './jobsTypes'
import GlobalServiceStatus from './GlobalServiceStatus'
import SubmittedRunCard from './SubmittedRunCard'
import LastfmJobPanel from './LastfmJobPanel'
import HotboardJobPanel from './HotboardJobPanel'
import PlaylistJobPanel from './PlaylistJobPanel'
import TextJobPanel from './TextJobPanel'

const JOB_PANELS: {
  key: JobPanel
  title: string
  description: string
  icon: React.ElementType
}[] = [
  { key: 'lastfm',   title: 'Last.fm 推荐',  description: '基于听歌数据生成推荐歌单',        icon: Sparkles },
  { key: 'hotboard', title: '网易云热榜',    description: '抓取热榜并同步到 Navidrome',      icon: Star },
  { key: 'playlist', title: '歌单链接',      description: '导入第三方平台歌单',               icon: Music },
  { key: 'text',     title: '文本歌单',       description: '上传 txt 文本歌单',                 icon: FileText },
]

const PANEL_ICONS: Record<JobPanel, React.ElementType> = {
  lastfm: Sparkles,
  hotboard: Star,
  playlist: Music,
  text: FileText,
}

export default function JobsPage() {
  const [activePanel, setActivePanel] = useState<JobPanel>('lastfm')
  const [submittedRun, setSubmittedRun] = useState<SubmittedRun | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings as any,
  })

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

  const currentIcon = PANEL_ICONS[activePanel]
  const CurrentIconComp = currentIcon

  return (
    <div className="page pb-16">
      <PageHeader title="任务执行" subtitle="选择任务类型，填写必要参数后提交执行。" />
      <GlobalServiceStatus settings={settings as any} />
      <SubmittedRunCard run={submittedRun} />

      {/* 当前任务面板内容 */}
      {activePanel === 'lastfm'   && <LastfmJobPanel   settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'hotboard' && <HotboardJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'playlist' && <PlaylistJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'text'      && <TextJobPanel     settings={settings as any} onSubmitted={setSubmittedRun} />}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setPanelOpen(v => !v)}
        className="fixed bottom-24 right-6 z-[51] flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        aria-label="打开任务类型"
      >
        <CurrentIconComp className="h-6 w-6" />
      </button>

      {/* 任务类型选择面板 */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 pb-24 dark:bg-slate-900 md:rounded-2xl md:pb-6"
          >
            {/* 标题栏 */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">任务类型</h3>
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

            {/* 任务类型网格 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              {JOB_PANELS.map(panel => {
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