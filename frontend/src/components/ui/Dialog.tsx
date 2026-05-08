import { X } from 'lucide-react'
import clsx from 'clsx'

export default function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  danger = false,
}: {
  open: boolean
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  danger?: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className={clsx(
                'text-base font-semibold',
                danger ? 'text-red-600 dark:text-red-300' : 'text-slate-900 dark:text-slate-50',
              )}
            >
              {title}
            </h2>
            {description && (
              <div className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="mt-4">{children}</div>}
        {footer && (
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}