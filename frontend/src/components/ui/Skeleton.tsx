import clsx from 'clsx'

export function Skeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80',
        className,
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card card-padding space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function TableSkeleton({
  rows = 5,
}: {
  rows?: number
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border bg-slate-50 dark:bg-slate-900 p-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton({
  fields = 4,
}: {
  fields?: number
}) {
  return (
    <div className="card card-padding space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}