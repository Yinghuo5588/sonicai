// frontend/src/pages/settings/library/components/MatchPipeline.tsx

import { Fragment } from 'react'

const STEP_LABELS: Record<string, string> = {
  manual_match: '人工匹配',
  match_cache: '匹配缓存',
  memory: '内存索引',
  db_alias: '别名索引',
  db_fuzzy: '数据库模糊',
  subsonic: '实时搜索',
}

export default function MatchPipeline({ steps }: { steps: any[] }) {
  if (!Array.isArray(steps) || steps.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-2xl border border-border p-3">
      <div className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => {
          const hit = !!step.hit
          const label = STEP_LABELS[step.step] || step.step || '-'
          return (
            <Fragment key={`${step.step}-${index}`}>
              <div
                className={
                  hit
                    ? 'rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }
              >
                <div className="font-semibold">{label}</div>
                <div className="mt-0.5 text-[10px] opacity-70">
                  {hit ? '命中' : '未命中'}
                  {step.duration_ms != null ? ` · ${step.duration_ms}ms` : ''}
                </div>
              </div>
              {index < steps.length - 1 && <div className="h-px w-6 bg-border" />}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}