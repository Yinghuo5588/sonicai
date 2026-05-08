// frontend/src/pages/jobs/SubmittedRunCard.tsx

import { Link } from 'react-router-dom'
import type { SubmittedRun } from './jobsTypes'

export default function SubmittedRunCard({ run }: { run: SubmittedRun | null }) {
  if (!run) return null
  return (
    <section className="card card-padding flex flex-col gap-3 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{run.title}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Run ID: {run.runId}{run.message ? `，${run.message}` : '，可前往推荐历史查看执行进度。'}
        </div>
      </div>
      <Link to={`/history/run/${run.runId}`} className="btn-secondary w-full sm:w-auto">查看任务详情</Link>
    </section>
  )
}