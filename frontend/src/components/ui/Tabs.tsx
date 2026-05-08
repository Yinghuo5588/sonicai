import clsx from 'clsx'

export type TabItem<T extends string> = {
  key: T
  label: string
  description?: string
  icon?: React.ElementType
  disabled?: boolean
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'cards',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  variant?: 'cards' | 'pills'
}) {
  if (variant === 'pills') {
    return (
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="flex min-w-max gap-2">
          {items.map(item => {
            const active = item.key === value
            return (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                onClick={() => onChange(item.key)}
                className={clsx(
                  'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                  active
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={clsx(
              'rounded-2xl border p-4 text-left transition disabled:opacity-50',
              active
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900',
            )}
          >
            {Icon && <Icon className="mb-3 h-5 w-5" />}
            <div className="text-sm font-semibold">{item.label}</div>
            {item.description && (
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {item.description}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}