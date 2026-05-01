import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react'
import { useToastStore, ToastType } from './toastStore'

function toastStyle(type: ToastType) {
  if (type === 'success') {
    return {
      wrapper:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
      icon: 'text-emerald-500',
      Icon: CheckCircle,
    }
  }

  if (type === 'error') {
    return {
      wrapper:
        'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200',
      icon: 'text-red-500',
      Icon: XCircle,
    }
  }

  if (type === 'warning') {
    return {
      wrapper:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
      icon: 'text-amber-500',
      Icon: AlertTriangle,
    }
  }

  return {
    wrapper:
      'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200',
    icon: 'text-cyan-500',
    Icon: Info,
  }
}

export default function ToastViewport() {
  const { items, removeToast } = useToastStore()

  if (items.length === 0) return null

  return (
    <div className="fixed right-3 top-3 z-[100] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5">
      {items.map(item => {
        const style = toastStyle(item.type)
        const Icon = style.Icon

        return (
          <div
            key={item.id}
            className={`rounded-2xl border px-3 py-3 shadow-xl backdrop-blur-xl transition-all ${style.wrapper}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-5">
                  {item.title}
                </div>
                {item.message && (
                  <div className="mt-0.5 text-xs opacity-80 leading-relaxed">
                    {item.message}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="rounded-lg p-1 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}