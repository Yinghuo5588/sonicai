// frontend/src/components/ui/Pagination.tsx

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
      <div className="text-xs text-slate-500 dark:text-slate-400">
        第 {safePage} / {totalPages} 页
        {typeof total === 'number' && <>，共 {total} 条{pageSize ? `，每页 ${pageSize} 条` : ''}</>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn-secondary" disabled={safePage <= 1} onClick={() => go(safePage - 1)}>上一页</button>
        {pages[0] > 1 && <>
          <button type="button" onClick={() => go(1)} className="h-10 min-w-10 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900">1</button>
          <span className="text-slate-400">...</span>
        </>}
        {pages.map(p => (
          <button key={p} type="button" onClick={() => go(p)} className={p === safePage ? 'h-10 min-w-10 rounded-xl bg-cyan-600 px-3 text-sm font-medium text-white' : 'h-10 min-w-10 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'}>
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && <>
          <span className="text-slate-400">...</span>
          <button type="button" onClick={() => go(totalPages)} className="h-10 min-w-10 rounded-xl border border-border bg-card px-3 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900">{totalPages}</button>
        </>}
        <button type="button" className="btn-secondary" disabled={safePage >= totalPages} onClick={() => go(safePage + 1)}>下一页</button>
      </div>
    </div>
  )
}