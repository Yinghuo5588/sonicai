// frontend/src/pages/settings/schedule/SchedulePage.tsx

import { Clock, DatabaseZap, History, ListRestart, ListTodo, Music, Radio, ShieldCheck, Sparkles } from 'lucide-react'
import { Accordion } from '@/components/ui'
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

export default function SchedulePage() {
  const { s, isLoading, mutation, hasChanges, handleChange, save } = useSettingsForm()

  if (isLoading) {
    return <div className="space-y-4"><FormSkeleton fields={4} /><FormSkeleton fields={3} /><FormSkeleton fields={4} /></div>
  }

  return (
    <div className="space-y-4">
      <CurrentTasksCard />

      <Accordion
        items={[
          { key: 'recommendation', title: 'Last.fm 推荐定时', description: '定时生成相似曲目和相邻艺术家歌单。', icon: Sparkles, defaultOpen: true, content: <RecommendationCronCard s={s} handleChange={handleChange} /> },
          { key: 'hotboard', title: '网易云热榜同步', description: '定时抓取网易云热榜并同步到 Navidrome。', icon: Radio, defaultOpen: true, content: <HotboardCronCard s={s} handleChange={handleChange} /> },
          { key: 'playlist-sync', title: '歌单链接增量同步', description: '监控指定歌单链接，变化后追加新歌。', icon: Music, defaultOpen: false, content: <PlaylistSyncCronCard s={s} handleChange={handleChange} /> },
          { key: 'missed-retry', title: '缺失歌曲重试', description: '补库后定时重试未命中歌曲。', icon: ListRestart, defaultOpen: false, content: <MissedRetryCronCard s={s} handleChange={handleChange} /> },
          { key: 'song-cache', title: '歌曲缓存刷新', description: '控制本地曲库缓存定时刷新。', icon: DatabaseZap, defaultOpen: false, content: <SongCacheCronCard s={s} handleChange={handleChange} /> },
          { key: 'concurrency', title: '任务执行策略', description: '控制后台任务最大并发数。', icon: ShieldCheck, defaultOpen: false, content: <TaskConcurrencyCard s={s} handleChange={handleChange} /> },
          { key: 'playlist-lifecycle', title: '歌单生命周期', description: '按类型配置歌单保留和 Navidrome 删除策略。', icon: ListTodo, defaultOpen: false, content: <PlaylistLifecycleCard s={s} handleChange={handleChange} /> },
          { key: 'history-cleanup', title: '历史记录清理', description: '清理 SonicAI 内部推荐历史和 Webhook 记录。', icon: History, defaultOpen: false, content: <HistoryCleanupCard s={s} handleChange={handleChange} /> },
        ]}
      />

      <div className="rounded-2xl border border-border bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
          <div>Cron 表达式统一使用 5 段格式：<span className="mx-1 font-mono">分 时 日 月 周</span>。保存配置后，后端会重新加载定时任务。</div>
        </div>
      </div>

      <SaveBar hasChanges={hasChanges} isPending={mutation.isPending} isSuccess={mutation.isSuccess} isError={mutation.isError} onSave={save} />
    </div>
  )
}