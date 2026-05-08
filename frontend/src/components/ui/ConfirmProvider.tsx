import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Dialog from './Dialog'

type ConfirmOptions = {
  title?: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions)
    return new Promise<boolean>(resolve => {
      setResolver(() => resolve)
    })
  }, [])

  const close = useCallback(
    (value: boolean) => {
      resolver?.(value)
      setResolver(null)
      setOptions(null)
    },
    [resolver],
  )

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={!!options}
        title={options?.title || (options?.danger ? '确认危险操作' : '确认操作')}
        description={options?.message}
        danger={!!options?.danger}
        onClose={() => close(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => close(false)}>
              {options?.cancelText || '取消'}
            </button>
            <button
              type="button"
              className={options?.danger ? 'btn-danger' : 'btn-primary'}
              onClick={() => close(true)}
            >
              {options?.confirmText || '确认'}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirmContext() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmContext must be used within ConfirmProvider')
  return ctx
}