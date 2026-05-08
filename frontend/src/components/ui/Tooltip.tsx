import { HelpCircle } from 'lucide-react'
import clsx from 'clsx'

export default function Tooltip({
  text,
  className,
}: {
  text?: string | null
  className?: string
}) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <span className={clsx('group relative inline-flex align-middle', className)}>
      <HelpCircle className="h-4 w-4 cursor-help text-slate-400 transition-colors group-hover:text-cyan-500" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 hidden w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl group-hover:block">
        <span className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-border" />
        {lines.map((line, index) => (
          <span key={index} className="block leading-relaxed">
            {line || <br />}
          </span>
        ))}
      </span>
    </span>
  )
}