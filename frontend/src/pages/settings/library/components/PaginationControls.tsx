// frontend/src/pages/settings/library/components/PaginationControls.tsx

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
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={current <= 1} onClick={onPrev}>
          上一页
        </button>
        <button type="button" className="btn-secondary" disabled={current >= total} onClick={onNext}>
          下一页
        </button>
      </div>
    </div>
  )
}