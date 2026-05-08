// frontend/src/pages/settings/library/components/DebugMatchResultView.tsx

import { labelOf, MATCH_SOURCE_LABELS } from '@/lib/labels'
import DebugTraceView from './DebugTraceView'
import MatchPipeline from './MatchPipeline'

export default function DebugMatchResultView({ data }: { data: any }) {
  const result = data?.result
  const steps = Array.isArray(data?.steps) ? data.steps : []

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-border p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">诊断结果</div>
        {result ? (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>状态: 命中</div>
            <div>ID: {result.id || '-'}</div>
            <div>曲目: {result.title || '-'}</div>
            <div>艺术家: {result.artist || '-'}</div>
            <div>来源: {labelOf(MATCH_SOURCE_LABELS, result.source)}</div>
            <div>得分: {result.score != null ? Number(result.score).toFixed(4) : '-'}</div>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400">最终未命中。</div>
        )}
      </div>

      {steps.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">匹配链路</div>
          <MatchPipeline steps={steps} />
          <DebugTraceView rawJson={JSON.stringify({ result, steps }, null, 2)} />
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900">
          当前诊断结果没有 steps。请确认后端已接入 match_track_debug。
        </div>
      )}
    </div>
  )
}