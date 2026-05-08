import clsx from 'clsx'

export default function MetricCard({
  label,
  value,
  description,
  tone = 'default',
  icon: Icon,
  className,
}: {
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  icon?: React.ElementType
  className?: string
}) {
  const toneClass = {
    default: 'bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    info: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300',
  }[tone]

  return (
    <div className={clsx('rounded-xl p-3', toneClass, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-70">{label}</div>
          <div className="mt-1 text-base font-semibold truncate">{value}</div>
          {description && (
            <div className="mt-1 text-xs opacity-70 leading-relaxed">{description}</div>
          )}
        </div>
        {Icon && (
          <div className="shrink-0 rounded-xl bg-white/60 p-2 dark:bg-black/20">
            <Icon className="h-4 w-4 opacity-70" />
          </div>
        )}
      </div>
    </div>
  )
}