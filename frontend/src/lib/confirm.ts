/**
 * Deprecated:
 * 新代码请使用 components/ui/useConfirm。
 * 这里暂时保留 window.confirm 兼容旧页面。
 */

export function confirmDanger(message: string) {
  return window.confirm(message)
}

export function confirmInfo(message: string) {
  return window.confirm(message)
}