// frontend/src/components/ui/InlineFeedback.tsx

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import clsx from 'clsx'

export default function InlineFeedback({
  type,
  title,
  message,
  className,
}: {
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: React.ReactNode
  className?: string
}) {
  const config = {
    success: { Icon: CheckCircle, wrapper: 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' },
    error:   { Icon: XCircle,       wrapper: 'border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' },
    warning: { Icon: AlertTriangle,  wrapper: 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' },
    info:    { Icon: Info,          wrapper: 'border-cyan-100 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300' },
  }[type]

  const Icon = config.Icon

  return (
    <div className={clsx('rounded-2xl border p-3 text-xs', config.wrapper, className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          {title && <div className="mb-0.5 font-semibold">{title}</div>}
          <div className="leading-relaxed">{message}</div>
        </div>
      </div>
    </div>
  )
}