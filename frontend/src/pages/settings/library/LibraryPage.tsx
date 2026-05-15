import { useState } from 'react'
import { Database, AlertTriangle, FileSearch, Heart, Search, UserCheck } from 'lucide-react'
import type { LibraryToolTab } from './libraryTypes'
import LibraryStatusCard from './LibraryStatusCard'
import LibrarySongsCard from './LibrarySongsCard'
import FavoriteTracksCard from './FavoriteTracksCard'
import MissedTracksCard from './MissedTracksCard'
import MatchDebugCard from './MatchDebugCard'
import ManualMatchCard from './ManualMatchCard'
import BottomSheetToolSelector from '@/components/ui/BottomSheetToolSelector'
import type { ToolOption } from '@/components/ui/BottomSheetToolSelector'

const TOOL_OPTIONS: ToolOption[] = [
  { key: 'status',    label: '状态概览',   description: '查看曲库、缓存和命中率',          icon: Database },
  { key: 'songs',     label: '搜索曲库',   description: '按歌名、艺术家、专辑搜索',        icon: Search },
  { key: 'favorites', label: '收藏缓存',   description: '同步 Navidrome 收藏歌曲',        icon: Heart },
  { key: 'missed',    label: '未命中歌曲', description: '查看待补库和可重试歌曲',          icon: AlertTriangle },
  { key: 'match',     label: '匹配诊断',   description: '查看匹配链路和候选结果',          icon: FileSearch },
  { key: 'manual',    label: '人工匹配',   description: '固定错误匹配的对应关系',          icon: UserCheck },
]

export default function LibraryPage() {
  const [activeTool, setActiveTool] = useState<LibraryToolTab>('status')

  return (
    <div className="space-y-3 pb-16">
      {activeTool === 'status'    && <LibraryStatusCard />}
      {activeTool === 'songs'     && <LibrarySongsCard />}
      {activeTool === 'favorites' && <FavoriteTracksCard />}
      {activeTool === 'missed'    && <MissedTracksCard />}
      {activeTool === 'match'   && <MatchDebugCard />}
      {activeTool === 'manual'  && <ManualMatchCard />}

      <BottomSheetToolSelector
        options={TOOL_OPTIONS}
        activeKey={activeTool}
        onChange={k => setActiveTool(k as LibraryToolTab)}
        fabLabel="曲库工具箱"
      />
    </div>
  )
}