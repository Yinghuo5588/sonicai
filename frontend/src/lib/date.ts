import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

/**
 * 格式化为 yyyy-MM-dd HH:mm
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  try {
    return format(new Date(isoString), 'yyyy-MM-dd HH:mm')
  } catch {
    return isoString
  }
}

/**
 * 24小时内显示相对时间（如"3小时前"），否则显示完整日期
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    const diffInHours = (Date.now() - date.getTime()) / (1000 * 60 * 60)
    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
    }
    return format(date, 'yyyy-MM-dd HH:mm', { locale: zhCN })
  } catch {
    return isoString
  }
}

/**
 * 精简格式：今天只显示时间，否则显示日期
 */
export function smartFormat(isoString: string | null | undefined): string {
  if (!isoString) return '-'
  try {
    const date = new Date(isoString)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'HH:mm')
    }
    return format(date, 'MM-dd HH:mm')
  } catch {
    return isoString
  }
}
