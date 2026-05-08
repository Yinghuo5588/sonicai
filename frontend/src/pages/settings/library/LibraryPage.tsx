// frontend/src/pages/settings/library/LibraryPage.tsx

import { AlertTriangle, Database, FileSearch, Search, ScrollText, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { Tabs, type TabItem } from '@/components/ui'
import type { LibraryToolTab } from './libraryTypes'
import LibraryStatusCard from './LibraryStatusCard'
import LibrarySongsCard from './LibrarySongsCard'
import MissedTracksCard from './MissedTracksCard'
import MatchDebugCard from './MatchDebugCard'
import ManualMatchCard from './ManualMatchCard'
import MatchLogsCard from './MatchLogsCard'

const TOOL_TABS: TabItem<LibraryToolTab>[] = [
  { key: 'status',   label: '状态概览',   description: '查看曲库、缓存和命中率',          icon: Database },
  { key: 'songs',    label: '搜索曲库',    description: '按歌名、艺术家、专辑搜索',        icon: Search },
  { key: 'missed',   label: '未命中歌曲',  description: '查看待补库和可重试歌曲',           icon: AlertTriangle },
  { key: 'match',    label: '匹配诊断',    description: '查看匹配链路和候选结果',           icon: FileSearch },
  { key: 'manual',   label: '人工匹配',    description: '固定错误匹配的对应关系',           icon: UserCheck },
  { key: 'logs',     label: '匹配日志',    description: '排查每次匹配的来源',               icon: ScrollText },
]

export default function LibraryPage() {
  const [activeTool, setActiveTool] = useState<LibraryToolTab>('status')

  return (
    <div className="space-y-3">
      <LibraryStatusCard />

      <section className="card card-padding space-y-4">
        <div>
          <h3 className="section-title">曲库工具箱</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            选择一个工具查看详细内容。
          </p>
        </div>
        <Tabs items={TOOL_TABS} value={activeTool} onChange={setActiveTool} />
      </section>

      {activeTool === 'status' && <LibraryStatusCard />}
      {activeTool === 'songs'  && <LibrarySongsCard />}
      {activeTool === 'missed' && <MissedTracksCard />}
      {activeTool === 'match'  && <MatchDebugCard />}
      {activeTool === 'manual' && <ManualMatchCard />}
      {activeTool === 'logs'   && <MatchLogsCard />}
    </div>
  )
}