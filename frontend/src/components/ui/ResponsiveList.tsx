// frontend/src/components/ui/ResponsiveList.tsx

import clsx from 'clsx'

export default function ResponsiveList<T>({
  items,
  getKey,
  isLoading = false,
  loading,
  empty,
  renderMobileItem,
  renderTableHeader,
  renderTableRow,
  className,
}: {
  items: T[]
  getKey: (item: T, index: number) => React.Key
  isLoading?: boolean
  loading?: React.ReactNode
  empty?: React.ReactNode
  renderMobileItem: (item: T, index: number) => React.ReactNode
  renderTableHeader: () => React.ReactNode
  renderTableRow: (item: T, index: number) => React.ReactNode
  className?: string
}) {
  if (isLoading) return <>{loading || null}</>
  if (!items.length) return <>{empty || null}</>

  return (
    <div className={clsx('space-y-3 md:space-y-0', className)}>
      <div className="space-y-3 md:hidden">
        {items.map((item, index) => (
          <div key={getKey(item, index)}>{renderMobileItem(item, index)}</div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              {renderTableHeader()}
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={getKey(item, index)} className="border-t border-border/60 hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  {renderTableRow(item, index)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}