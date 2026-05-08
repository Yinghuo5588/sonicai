// frontend/src/pages/jobs/JobsPage.tsx

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import { fetchSettings } from './jobsApi'
import type { JobPanel, SubmittedRun } from './jobsTypes'
import JobPanelTabs from './JobPanelTabs'
import GlobalServiceStatus from './GlobalServiceStatus'
import SubmittedRunCard from './SubmittedRunCard'
import LastfmJobPanel from './LastfmJobPanel'
import HotboardJobPanel from './HotboardJobPanel'
import PlaylistJobPanel from './PlaylistJobPanel'
import TextJobPanel from './TextJobPanel'

export default function JobsPage() {
  const [activePanel, setActivePanel] = useState<JobPanel>('lastfm')
  const [submittedRun, setSubmittedRun] = useState<SubmittedRun | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings as any,
  })

  return (
    <div className="page">
      <PageHeader title="任务执行" subtitle="选择任务类型，填写必要参数后提交执行。" />
      <GlobalServiceStatus settings={settings as any} />
      <SubmittedRunCard run={submittedRun} />
      <JobPanelTabs value={activePanel} onChange={setActivePanel} />
      {activePanel === 'lastfm'   && <LastfmJobPanel   settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'hotboard' && <HotboardJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'playlist' && <PlaylistJobPanel settings={settings as any} onSubmitted={setSubmittedRun} />}
      {activePanel === 'text'      && <TextJobPanel     settings={settings as any} onSubmitted={setSubmittedRun} />}
    </div>
  )
}