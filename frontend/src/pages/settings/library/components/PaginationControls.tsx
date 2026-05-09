// frontend/src/pages/settings/library/components/PaginationControls.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PaginationControls({
  current,
  total,
  onPrev,
  onNext,
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        第 {current} / {total} 页
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={current <= 1}
          onClick={onPrev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={current >= total}
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
