import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'

export type AccordionItem = {
  key: string
  title: string
  description?: string
  icon?: React.ElementType
  defaultOpen?: boolean
  content: React.ReactNode
}

export default function Accordion({
  items,
  allowMultiple = true,
}: {
  items: AccordionItem[]
  allowMultiple?: boolean
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    return new Set(items.filter(item => item.defaultOpen).map(item => item.key))
  })

  const toggle = (key: string) => {
    setOpenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        if (!allowMultiple) next.clear()
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const Icon = item.icon
        const open = openKeys.has(item.key)
        return (
          <section key={item.key} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(item.key)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left md:p-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                {Icon && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
                    <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="section-title">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown
                className={clsx(
                  'mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
            {open && (
              <div className="border-t border-border/60 p-4 md:p-5">
                {item.content}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}