// frontend/src/pages/settings/library/components/DebugTraceView.tsx

import { labelOf, MATCH_SOURCE_LABELS } from '@/lib/labels'
import CandidateRow from './CandidateRow'
import MatchPipeline from './MatchPipeline'

function AliasList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-slate-400">{title}</div>
      <div className="flex flex-wrap gap-1">
        {values.map(value => (
          <span key={value} className="badge-muted">{value}</span>
        ))}
      </div>
    </div>
  )
}

function StepDetail({ step, index }: { step: any; index: number }) {
  const hit = !!step.hit
  const bestScore = step.best_score != null ? Number(step.best_score).toFixed(4) : '-'
  const threshold = step.threshold != null ? Number(step.threshold).toFixed(2) : '-'

  return (
    <div
      className={
        hit
          ? 'rounded-xl border border-green-200 bg-green-50 p-3 text-xs dark:border-green-900 dark:bg-green-950/30'
          : 'rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-slate-400">[{index}]</span>
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {step.step || step.step_name || '-'}
        </span>
        <span className={hit ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
          {hit ? '命中' : '未命中'}
        </span>
        {step.duration_ms != null && (
          <span className="ml-auto text-slate-400">{step.duration_ms}ms</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
        {step.candidates_count != null && <span>候选数: {step.candidates_count}</span>}
        <span>最佳得分: {bestScore}</span>
        {step.threshold != null && <span>阈值: {threshold}</span>}
        {step.result_id && <span>结果 ID: {step.result_id}</span>}
      </div>

      {Array.isArray(step.title_aliases) && step.title_aliases.length > 0 && (
        <AliasList title="Title aliases" values={step.title_aliases} />
      )}
      {Array.isArray(step.artist_aliases) && step.artist_aliases.length > 0 && (
        <AliasList title="Artist aliases" values={step.artist_aliases} />
      )}

      {Array.isArray(step.top_candidates) && step.top_candidates.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-slate-400">Top Candidates</div>
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {step.top_candidates.map((candidate: any, i: number) => (
              <CandidateRow key={i} candidate={candidate} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {step.best_candidate && !step.top_candidates?.length && (
        <div className="mt-3">
          <div className="mb-1 text-slate-400">Best Candidate</div>
          <CandidateRow candidate={step.best_candidate} index={1} />
        </div>
      )}

      {step.error && (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-red-500 dark:bg-red-950/40">
          {step.error}
        </div>
      )}
    </div>
  )
}

export default function DebugTraceView({ rawJson }: { rawJson: string | null | undefined }) {
  if (!rawJson) return <div className="text-xs text-slate-400">无详情数据。</div>

  let data: any
  try {
    data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson
  } catch {
    return (
      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-500 dark:bg-red-950/40">
        raw_json 解析失败，可能不是合法 JSON。
      </div>
    )
  }

  const steps = Array.isArray(data?.steps) ? data.steps : []
  const result = data?.result ?? data

  if (!steps.length) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          这条日志没有链路调试 steps。可能是调试模式未开启时产生的旧日志。
        </div>
        {result && (
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          匹配链路追踪，共 {steps.length} 步
        </div>
        {result?.source && (
          <span className="badge-muted">
            最终来源: {labelOf(MATCH_SOURCE_LABELS, result.source)}
          </span>
        )}
      </div>

      <MatchPipeline steps={steps} />

      <div className="space-y-2">
        {steps.map((step: any, i: number) => (
          <StepDetail key={i} step={step} index={i + 1} />
        ))}
      </div>

      <div className="rounded-xl border border-border p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">最终结果</div>
        {result ? (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
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
    </div>
  )
}