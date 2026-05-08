// frontend/src/pages/jobs/components/PreflightCheck.tsx

import { CheckCircle, XCircle } from 'lucide-react'
import type { PreflightItem } from '../jobsTypes'

export default function PreflightCheck({ items, title = '执行前检查' }: { items: PreflightItem[]; title?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <div className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{title}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(item => (
          <div key={item.label} className={item.ok ? 'flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400' : 'flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400'}>
            {item.ok ? <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>
              {item.label}
              {item.hint && <span className="ml-1 opacity-70">{item.hint}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}