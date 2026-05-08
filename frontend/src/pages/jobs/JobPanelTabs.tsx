// frontend/src/pages/jobs/JobPanelTabs.tsx

import { FileText, Music, Sparkles, Star } from 'lucide-react'
import clsx from 'clsx'
import type { JobPanel } from './jobsTypes'

const JOB_PANELS = [
  { key: 'lastfm' as JobPanel,   title: 'Last.fm 推荐',  desc: '基于听歌数据生成推荐歌单', icon: Sparkles },
  { key: 'hotboard' as JobPanel,  title: '网易云热榜',   desc: '抓取热榜并同步到 Navidrome', icon: Star },
  { key: 'playlist' as JobPanel, title: '歌单链接',     desc: '导入第三方平台歌单',         icon: Music },
  { key: 'text' as JobPanel,     title: '文本歌单',     desc: '上传 txt 文本歌单',           icon: FileText },
]

export default function JobPanelTabs({ value, onChange }: { value: JobPanel; onChange: (v: JobPanel) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {JOB_PANELS.map(item => {
        const Icon = item.icon
        const active = value === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              'card card-padding text-left transition',
              active ? 'bg-cyan-50/70 ring-2 ring-cyan-500 dark:bg-cyan-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">
                <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}