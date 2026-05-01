import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastState {
  items: ToastItem[]
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],

  pushToast: toast => {
    const id = createToastId()
    const duration = toast.duration ?? 3500

    set(state => ({
      items: [
        ...state.items,
        {
          ...toast,
          id,
          duration,
        },
      ],
    }))

    if (duration > 0) {
      window.setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },

  removeToast: id => {
    set(state => ({
      items: state.items.filter(item => item.id !== id),
    }))
  },

  clearToasts: () => {
    set({ items: [] })
  },
}))