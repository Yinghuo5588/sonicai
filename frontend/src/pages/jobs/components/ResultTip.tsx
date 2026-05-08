// frontend/src/pages/jobs/components/ResultTip.tsx

import { CheckCircle, XCircle } from 'lucide-react'

export default function ResultTip({ isSuccess, isError, error }: { isSuccess: boolean; isError: boolean; error?: unknown }) {
  if (isSuccess) {
    return (
      <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="h-3.5 w-3.5" />
        已提交，可在推荐历史查看进度
      </p>
    )
  }
  if (isError) {
    return (
      <p className="flex items-center gap-1 text-xs text-red-500">
        <XCircle className="h-3.5 w-3.5" />
        {String((error as any)?.message || '操作失败')}
      </p>
    )
  }
  return null
}