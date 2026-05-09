import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Music, Sparkles, Star } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { fetchSettings } from './jobsApi'
import type { JobPanel, SubmittedRun } from './jobsTypes'
import GlobalServiceStatus from './GlobalServiceStatus'
import SubmittedRunCard from './SubmittedRunCard'
import LastfmJobPanel from './LastfmJobPanel'
import HotboardJobPanel from './HotboardJobPanel'
import PlaylistJobPanel from './PlaylistJobPanel'
import TextJobPanel from './TextJobPanel'
import BottomSheetToolSelector, { type ToolOption } from '@/components/ui/BottomSheetToolSelector'

const JOB_OPTIONS: ToolOption[] = [
  { key: 'lastfm',   label: 'Last.fm 推荐',  description: '基于听歌数据生成推荐歌单',        icon: Sparkles },
  { key: 'hotboard', label: '网易云热榜',    description: '抓取热榜并同步到 Navidrome',      icon: Star },
  { key: 'playlist', label: '歌单链接',      description: '导入第三方平台歌单',               icon: Music },
  { key: 'text',     label: '文本歌单',       description: '上传 txt 文本歌单',                 icon: FileText },
]

export default function JobsPage() {
  const [activePanel, setActivePanel] = useState<JobPanel>('lastfm')
  const [submittedRun, setSubmittedRun] = useState<SubmittedRun | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings as any,
  })

  return (
    <div className="page pb-16">
      <PageHeader title="任务执行" subtitle="选择任务类型，填写必要参数后提交执行。" />
      <GlobalServiceStatus settings={settings as any} />
      <SubmittedRunCard run={submittedRun} />

      {activePanel === 'lastfm'   && <LastfmJobPanel   settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'hotboard' && <HotboardJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'playlist' && <PlaylistJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'text'      && <TextJobPanel     settings={settings as any} onSubmitted={setSubmittedRun} />}

      <BottomSheetToolSelector
        options={JOB_OPTIONS}
        activeKey={activePanel}
        onChange={k => setActivePanel(k as JobPanel)}
        fabLabel="任务类型"
      />
    </div>
  )
}