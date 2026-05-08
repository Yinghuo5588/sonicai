// frontend/src/components/ui/SectionToolbar.tsx

import clsx from 'clsx'

export default function SectionToolbar({
  left,
  right,
  className,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  if (!left && !right) return null
  return (
    <div className={clsx('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {left && <div className="flex min-w-0 flex-wrap items-center gap-2">{left}</div>}
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}