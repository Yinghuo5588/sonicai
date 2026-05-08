import { useConfirmContext } from './ConfirmProvider'

export function useConfirm() {
  const { confirm } = useConfirmContext()
  return {
    confirm,
    confirmDanger: (message: React.ReactNode, title = '确认危险操作') =>
      confirm({ title, message, danger: true, confirmText: '确认', cancelText: '取消' }),
    confirmInfo: (message: React.ReactNode, title = '确认操作') =>
      confirm({ title, message, danger: false, confirmText: '确认', cancelText: '取消' }),
  }
}