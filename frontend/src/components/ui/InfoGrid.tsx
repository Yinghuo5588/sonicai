// frontend/src/components/ui/InfoGrid.tsx

import clsx from 'clsx'

export type InfoGridItem = {
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const toneClass: Record<NonNullable<InfoGridItem['tone']>, string> = {
  default: 'bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  danger:  'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  info:    'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300',
}

export default function InfoGrid({
  items,
  columns = 4,
  className,
}: {
  items: InfoGridItem[]
  columns?: 2 | 3 | 4 | 5
  className?: string
}) {
  const gridClass = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 xl:grid-cols-4', 5: 'grid-cols-2 sm:grid-cols-5' }[columns]

  return (
    <div className={clsx('grid gap-3', gridClass, className)}>
      {items.map(item => (
        <div key={item.label} className={clsx('rounded-xl p-3', toneClass[item.tone || 'default'])}>
          <div className="text-xs opacity-70">{item.label}</div>
          <div className="mt-1 truncate text-base font-semibold">{item.value}</div>
          {item.description && <div className="mt-1 text-xs opacity-70">{item.description}</div>}
        </div>
      ))}
    </div>
  )
}