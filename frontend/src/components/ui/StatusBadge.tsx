import {
  CheckCircle,
  Clock,
  RefreshCw,
  RotateCw,
  XCircle,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  success: '完成',
  completed: '完成',
  failed: '失败',
  error: '失败',
  running: '运行中',
  pending: '等待中',
  stopped: '已停止',
  partial_success: '部分成功',
  retrying: '重试中',
  ignored: '已忽略',
  matched: '已匹配',
}

export default function StatusBadge({
  status,
  label,
}: {
  status?: string | null
  label?: string
}) {
  const s = status || '-'
  const text = label || STATUS_LABELS[s] || s

  if (s === 'success' || s === 'completed' || s === 'matched') {
    return (
      <span className="badge badge-success flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {text}
      </span>
    )
  }

  if (s === 'failed' || s === 'error') {
    return (
      <span className="badge badge-danger flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        {text}
      </span>
    )
  }

  if (s === 'running') {
    return (
      <span className="badge badge-info animate-pulse flex items-center gap-1">
        <RotateCw className="h-3 w-3" />
        {text}
      </span>
    )
  }

  if (s === 'retrying') {
    return (
      <span className="badge badge-warning flex items-center gap-1">
        <RefreshCw className="h-3 w-3" />
        {text}
      </span>
    )
  }

  if (s === 'pending') {
    return (
      <span className="badge badge-muted flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {text}
      </span>
    )
  }

  if (s === 'stopped' || s === 'partial_success' || s === 'ignored') {
    return <span className="badge badge-warning">{text}</span>
  }

  return <span className="badge badge-muted">{text}</span>
}
