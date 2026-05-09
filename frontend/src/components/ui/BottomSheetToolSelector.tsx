import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export interface ToolOption {
  key: string
  label: string
  description: string
  icon: React.ElementType
}

interface BottomSheetToolSelectorProps {
  options: ToolOption[]
  activeKey: string
  onChange: (key: string) => void
  /** aria-label for the FAB button */
  fabLabel: string
  /** Optional extra class for the FAB button */
  fabClassName?: string
}

export default function BottomSheetToolSelector({
  options,
  activeKey,
  onChange,
  fabLabel,
  fabClassName = '',
}: BottomSheetToolSelectorProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const activeOption = options.find(o => o.key === activeKey)
  const IconComp = activeOption?.icon ?? X

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-24 right-6 z-[51] flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8 ${fabClassName}`}
        aria-label={fabLabel}
      >
        <IconComp className="h-6 w-6" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 pb-24 dark:bg-slate-900 md:rounded-2xl md:pb-6"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{fabLabel}</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">选择一个选项</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Options grid — 2 columns, variable rows */}
            <div className="grid grid-cols-2 gap-3">
              {options.map(option => {
                const Icon = option.icon
                const active = option.key === activeKey
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      onChange(option.key)
                      setOpen(false)
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                        : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="mb-2 h-5 w-5" />
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {option.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}