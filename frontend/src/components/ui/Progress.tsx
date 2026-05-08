import clsx from 'clsx'

export default function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  className,
}: {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className={clsx('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}