import { useToastStore } from './toastStore'

export function useToast() {
  const pushToast = useToastStore(state => state.pushToast)

  return {
    success: (title: string, message?: string) =>
      pushToast({ type: 'success', title, message }),

    error: (title: string, message?: string) =>
      pushToast({ type: 'error', title, message, duration: 5000 }),

    warning: (title: string, message?: string) =>
      pushToast({ type: 'warning', title, message, duration: 4500 }),

    info: (title: string, message?: string) =>
      pushToast({ type: 'info', title, message }),
  }
}