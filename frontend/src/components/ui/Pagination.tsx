// frontend/src/components/ui/Pagination.tsx

import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

function buildPageNumbers(page: number, totalPages: number) {
  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  total?: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const pages = buildPageNumbers(safePage, totalPages)
  const go = (next: number) => onPageChange(Math.min(Math.max(next, 1), totalPages))

  return (
    <div className={clsx('card card-padding flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {/* 页码信息 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {typeof total === 'number' ? (
            <>第 {safePage} / {totalPages} 页，共 {total} 条</>
          ) : (
            <>第 {safePage} / {totalPages} 页</>
          )}
        </div>
      </div>

      {/* 分页控件 */}
      <div className="flex items-center justify-end gap-2">
        {/* 上一页 */}
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => go(safePage - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-900 dark:bg-slate-800"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* 页码数字 */}
        <div className="flex items-center gap-1">
          {pages[0] > 1 && (
            <>
              <button type="button" onClick={() => go(1)} className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-card px-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800">1</button>
              {pages[0] > 2 && <span className="text-slate-400 text-xs">...</span>}
            </>
          )}
          {pages.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              className={p === safePage
                ? 'flex h-9 min-w-9 items-center justify-center rounded-xl bg-cyan-500 px-2 text-sm font-medium text-white'
                : 'flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-card px-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800'
              }
            >
              {p}
            </button>
          ))}
          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && <span className="text-slate-400 text-xs">...</span>}
              <button type="button" onClick={() => go(totalPages)} className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-card px-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800">{totalPages}</button>
            </>
          )}
        </div>

        {/* 下一页 */}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => go(safePage + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-900 dark:border-slate-700 dark:bg-slate-800"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
