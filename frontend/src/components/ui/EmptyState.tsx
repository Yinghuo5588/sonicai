import { Link } from 'react-router-dom'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  action,
}: {
  icon?: React.ElementType
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
  action?: () => void
}) {
  return (
    <div className="card card-padding text-center">
      {Icon && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </div>

      {description && (
        <div className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </div>
      )}

      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-secondary mt-4">
          {actionLabel}
        </Link>
      )}

      {actionLabel && action && (
        <button type="button" onClick={action} className="btn-secondary mt-4">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
