import {
  CheckCircle,
  Clock,
  RefreshCw,
  RotateCw,
  XCircle,
} from 'lucide-react'
import { COMMON_STATUS_LABELS, labelOf } from '@/lib/labels'

export default function StatusBadge({
  status,
  label,
}: {
  status?: string | null
  label?: string
}) {
  const s = status || '-'
  const text = label || labelOf(COMMON_STATUS_LABELS, s)

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