import { Fragment, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { useToast } from '@/components/ui/useToast'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  useSettingsForm,
} from './SettingsShared'
import { CheckCircle, RefreshCcw, Search, XCircle, Wrench, ListFilter, FileSearch, UserCheck, ScrollText, Database, AlertTriangle } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import {
  MATCH_SOURCE_LABELS,
  SONG_SOURCE_LABELS,
  MISSED_STATUS_LABELS,
  labelOf,
} from '@/lib/labels'

const PAGE_SIZE = 20

// ── API functions ──────────────────────────────────────────────────────────────

async function fetchLibraryStatus() {
  return apiFetch('/library/status')
}

async function triggerLibrarySync() {
  return apiFetch('/library/sync', { method: 'POST' })
}

async function fetchLibrarySongs(q: string, page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String((page - 1) * PAGE_SIZE))
  if (q.trim()) params.set('q', q.trim())
  return apiFetch(`/library/songs?${params.toString()}`)
}

async function fetchMatchLogs(page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String((page - 1) * PAGE_SIZE))
  return apiFetch(`/library/match-logs?${params.toString()}`)
}

async function fetchManualMatches(page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String((page - 1) * PAGE_SIZE))
  return apiFetch(`/library/manual-matches?${params.toString()}`)
}

async function createManualMatch(payload: {
  input_title: string
  input_artist?: string
  navidrome_id: string
  note?: string
}) {
  return apiFetch('/library/manual-matches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function deleteManualMatch(id: number) {
  return apiFetch(`/library/manual-matches/${id}`, { method: 'DELETE' })
}

async function clearMatchCache() {
  return apiFetch('/library/match-cache', { method: 'DELETE' })
}

async function clearLowConfidenceCache(maxScore: number) {
  return apiFetch(`/library/match-cache/low-confidence?max_score=${maxScore}`, { method: 'DELETE' })
}

async function clearOldMatchLogs(days: number) {
  return apiFetch(`/library/match-logs/old?days=${days}`, { method: 'DELETE' })
}

async function debugMatch(payload: { title: string; artist?: string; threshold: number }) {
  return apiFetch('/library/debug-match', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ── Missed Tracks API ─────────────────────────────────────────────────────────

async function fetchMissedTracks(status: string, q: string, page: number) {
  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  params.set('offset', String((page - 1) * PAGE_SIZE))
  if (status) params.set('status', status)
  if (q.trim()) params.set('q', q.trim())
  return apiFetch(`/missed-tracks?${params.toString()}`)
}

async function fetchMissedTrackStats() {
  return apiFetch('/missed-tracks/stats')
}

async function retryMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/retry`, { method: 'POST' })
}

async function retryMissedTracksBatch() {
  return apiFetch('/missed-tracks/retry', { method: 'POST' })
}

async function ignoreMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/ignore`, { method: 'POST' })
}

async function resetMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}/reset`, { method: 'POST' })
}

async function deleteMissedTrack(id: number) {
  return apiFetch(`/missed-tracks/${id}`, { method: 'DELETE' })
}

// ── Match pipeline stepper ────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  manual_match: '人工匹配',
  match_cache: '匹配缓存',
  memory: '内存索引',
  db_alias: '别名索引',
  db_fuzzy: '数据库模糊',
  subsonic: '实时搜索',
}

function MatchPipeline({ steps }: { steps: any[] }) {
  if (!Array.isArray(steps) || steps.length === 0) return null

  return (
    <div className="rounded-2xl border border-border p-3 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {steps.map((step, index) => {
          const hit = !!step.hit
          const label = STEP_LABELS[step.step] || step.step || '-'

          return (
            <Fragment key={`${step.step}-${index}`}>
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  hit
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                <div className="font-semibold">{label}</div>
                <div className="mt-0.5 text-[10px] opacity-70">
                  {hit ? '命中' : '未命中'}
                  {step.duration_ms != null ? ` · ${step.duration_ms}ms` : ''}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="h-px w-6 bg-border" />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  desc,
}: {
  label: string
  value: React.ReactNode
  desc?: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-base font-semibold text-slate-900 dark:text-slate-50 mt-1">{value}</div>
      {desc && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{desc}</div>}
    </div>
  )
}

function formatPercent(v: number | undefined | null) {
  return `${Math.round((v || 0) * 100)}%`
}

function PaginationControls({
  current,
  total,
  onPrev,
  onNext,
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 mt-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        第 {current} / {total} 页
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={current <= 1} onClick={onPrev}>上一页</button>
        <button className="btn-secondary" disabled={current >= total} onClick={onNext}>下一页</button>
      </div>
    </div>
  )
}

// ── Debug trace components ─────────────────────────────────────────────────────

function AliasList({
  title,
  values,
}: {
  title: string
  values: string[]
}) {
  return (
    <div className="mt-2">
      <div className="text-slate-400 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {values.map(value => (
          <span key={value} className="badge-muted">{value}</span>
        ))}
      </div>
    </div>
  )
}

function CandidateRow({
  candidate,
  index,
}: {
  candidate: any
  index: number
}) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-2 border border-border">
      <div className="flex items-start gap-2">
        <span className="font-mono text-slate-400">#{index}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-700 dark:text-slate-200 truncate">
            {candidate.title || '-'}
          </div>
          <div className="text-slate-500 dark:text-slate-400 truncate">
            {candidate.artist || '-'}
          </div>
          {candidate.album && (
            <div className="text-slate-400 truncate">专辑：{candidate.album}</div>
          )}
          {candidate.id && (
            <div className="text-slate-400 truncate">ID：{candidate.id}</div>
          )}
          {candidate.query_label && (
            <div className="text-slate-400 truncate">Query：{candidate.query_label}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-slate-700 dark:text-slate-200 font-semibold">
            {candidate.score != null ? Number(candidate.score).toFixed(4) : '-'}
          </div>
          <div className="text-slate-400">score</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
        {candidate.title_score != null && (
          <span>title：{Number(candidate.title_score).toFixed(3)}</span>
        )}
        {candidate.title_core_score != null && (
          <span>core：{Number(candidate.title_core_score).toFixed(3)}</span>
        )}
        {candidate.artist_score != null && (
          <span>artist：{Number(candidate.artist_score).toFixed(3)}</span>
        )}
        {candidate.pg_title_sim != null && (
          <span>pg_title：{Number(candidate.pg_title_sim).toFixed(3)}</span>
        )}
        {candidate.pg_artist_sim != null && (
          <span>pg_artist：{Number(candidate.pg_artist_sim).toFixed(3)}</span>
        )}
        {candidate.duration != null && (
          <span>duration：{candidate.duration}s</span>
        )}
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
      className={`rounded-xl p-3 text-xs border ${
        hit
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
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
        {step.candidates_count != null && <span>候选数：{step.candidates_count}</span>}
        <span>最佳得分：{bestScore}</span>
        {step.threshold != null && <span>阈值：{threshold}</span>}
        {step.result_id && <span>结果 ID：{step.result_id}</span>}
      </div>

      {Array.isArray(step.title_aliases) && step.title_aliases.length > 0 && (
        <AliasList title="Title aliases" values={step.title_aliases} />
      )}
      {Array.isArray(step.artist_aliases) && step.artist_aliases.length > 0 && (
        <AliasList title="Artist aliases" values={step.artist_aliases} />
      )}

      {Array.isArray(step.top_candidates) && step.top_candidates.length > 0 && (
        <div className="mt-3">
          <div className="text-slate-400 mb-1">Top Candidates</div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {step.top_candidates.map((c: any, i: number) => (
              <CandidateRow key={i} candidate={c} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {step.best_candidate && !step.top_candidates?.length && (
        <div className="mt-3">
          <div className="text-slate-400 mb-1">Best Candidate</div>
          <CandidateRow candidate={step.best_candidate} index={1} />
        </div>
      )}

      {step.error && (
        <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-red-500">
          {step.error}
        </div>
      )}
    </div>
  )
}

function DebugTraceView({ rawJson }: { rawJson: string | null | undefined }) {
  if (!rawJson) {
    return <div className="text-xs text-slate-400">无详情数据。</div>
  }

  let data: any
  try {
    data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson
  } catch {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-500">
        raw_json 解析失败，可能不是合法 JSON。
      </div>
    )
  }

  const steps = Array.isArray(data?.steps) ? data.steps : []
  const result = data?.result ?? data

  if (!steps.length) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-slate-100 dark:bg-slate-900 p-3 text-xs text-slate-500 dark:text-slate-400">
          这条日志没有链路调试 steps。可能是调试模式未开启时产生的旧日志。
        </div>
        {result && (
          <pre className="text-xs overflow-x-auto rounded-xl bg-slate-950 text-slate-100 p-3">
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
            最终来源：{labelOf(MATCH_SOURCE_LABELS, result.source)}
          </span>
        )}
      </div>

      <MatchPipeline steps={steps} />

      <div className="space-y-2">
        {steps.map((s: any, i: number) => (
          <StepDetail key={i} step={s} index={i + 1} />
        ))}
      </div>

      <div className="rounded-xl border border-border p-3">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
          最终结果
        </div>
        {result ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>ID：{result.id || '-'}</div>
            <div>曲目：{result.title || '-'}</div>
            <div>艺术家：{result.artist || '-'}</div>
            <div>来源：{labelOf(MATCH_SOURCE_LABELS, result.source)}</div>
            <div>得分：{result.score != null ? Number(result.score).toFixed(4) : '-'}</div>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400">最终未命中。</div>
        )}
      </div>
    </div>
  )
}

function DebugMatchResultView({ data }: { data: any }) {
  const result = data?.result
  const steps = Array.isArray(data?.steps) ? data.steps : []

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-border p-3">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
          诊断结果
        </div>
        {result ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>状态：命中</div>
            <div>ID：{result.id || '-'}</div>
            <div>曲目：{result.title || '-'}</div>
            <div>艺术家：{result.artist || '-'}</div>
            <div>来源：{labelOf(MATCH_SOURCE_LABELS, result.source)}</div>
            <div>得分：{result.score != null ? Number(result.score).toFixed(4) : '-'}</div>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400">最终未命中。</div>
        )}
      </div>

      {steps.length > 0 ? (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            匹配链路
          </div>

          <MatchPipeline steps={steps} />

          <div className="space-y-2">
            {steps.map((s: any, i: number) => (
              <StepDetail key={i} step={s} index={i + 1} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-xs text-slate-500">
          当前诊断结果没有 steps。请确认后端已接入 match_track_debug。
        </div>
      )}
    </div>
  )
}

// ── Missed Tracks ─────────────────────────────────────────────────────────────

function MissedTracksCard() {
  const queryClient = useQueryClient()
  const [missedStatus, setMissedStatus] = useState('pending')
  const [missedQuery, setMissedQuery] = useState('')
  const [missedPage, setMissedPage] = useState(1)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  const { data: missedStats } = useQuery({
    queryKey: ['missed-track-stats'],
    queryFn: fetchMissedTrackStats,
  })

  const { data: missedData, isLoading: missedLoading } = useQuery({
    queryKey: ['missed-tracks', missedStatus, missedQuery, missedPage],
    queryFn: () => fetchMissedTracks(missedStatus, missedQuery, missedPage),
  })

  const retryMissedMutation = useMutation({
    mutationFn: retryMissedTrack,
    onSuccess: (data: any) => {
      setFeedback({ type: 'success', message: data?.message || '重试成功' })
      queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
      queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: `重试失败: ${error.message}` })
    },
  })

  const retryMissedBatchMutation = useMutation({
    mutationFn: retryMissedTracksBatch,
    onSuccess: (data: any) => {
      setFeedback({ type: 'success', message: data?.message || '批量重试任务已启动' })
      queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
      queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: `批量重试失败: ${error.message}` })
    },
  })

  const ignoreMissedMutation = useMutation({
    mutationFn: ignoreMissedTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
      queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
    },
  })

  const resetMissedMutation = useMutation({
    mutationFn: resetMissedTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
      queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
    },
  })

  const deleteMissedMutation = useMutation({
    mutationFn: deleteMissedTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
      queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
    },
  })

  const totalMissedPages = useMemo(() => {
    const total = Number((missedData as any)?.total || 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [missedData])

  return (
    <SectionCard title="未命中歌曲">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        这里记录自动匹配未命中的歌曲。它是任务池,不是普通日志。
        同一首歌会自动去重并累计出现次数。补库后可手动或定时重试。
      </p>

      {feedback && (
        <div className={`text-xs px-3 py-2 rounded-lg mt-3 flex items-center gap-1.5 ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300'
            : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
        <StatusCard label="全部" value={(missedStats as any)?.total ?? 0} />
        <StatusCard label="待处理" value={(missedStats as any)?.pending ?? 0} />
        <StatusCard label="已匹配" value={(missedStats as any)?.matched ?? 0} />
        <StatusCard label="失败" value={(missedStats as any)?.failed ?? 0} />
        <StatusCard label="已忽略" value={(missedStats as any)?.ignored ?? 0} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <select
          value={missedStatus}
          onChange={e => { setMissedStatus(e.target.value); setMissedPage(1) }}
          className="select sm:w-40"
        >
          <option value="">全部</option>
          <option value="pending">待处理</option>
          <option value="matched">已匹配</option>
          <option value="failed">失败</option>
          <option value="ignored">已忽略</option>
        </select>
        <input
          type="text"
          value={missedQuery}
          onChange={e => { setMissedQuery(e.target.value); setMissedPage(1) }}
          placeholder="搜索歌名或艺术家"
          className="input flex-1"
        />
        <button
          className="btn-secondary"
          disabled={retryMissedBatchMutation.isPending}
          onClick={() => retryMissedBatchMutation.mutate()}
        >
          {retryMissedBatchMutation.isPending ? '启动中...' : '批量重试'}
        </button>
      </div>

      <div className="card overflow-hidden mt-3">
        {missedLoading ? (
          <div className="p-4 text-sm text-slate-500">加载未命中歌曲...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left p-3">歌曲</th>
                <th className="text-left p-3 hidden md:table-cell">状态</th>
                <th className="text-left p-3 hidden lg:table-cell">出现/重试</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {((missedData as any)?.items || []).length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center"><EmptyState icon={AlertTriangle} title="暂无未命中歌曲" description="当前没有待处理的缺失歌曲，说明最近匹配状态良好。" /></td></tr>
              )}
              {((missedData as any)?.items || []).map((item: any) => (
                <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.artist || '-'}</div>
                    {item.last_error && <div className="text-xs text-red-500 mt-1">{item.last_error}</div>}
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="badge-muted">{labelOf(MISSED_STATUS_LABELS, item.status)}</span>
                  </td>
                  <td className="p-3 hidden lg:table-cell text-slate-500">
                    出现 {item.seen_count ?? 0} 次 · 重试 {item.retry_count ?? 0}/{item.max_retries ?? 5}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {item.status !== 'matched' && (
                        <button
                          className="text-xs text-blue-500 hover:underline disabled:opacity-50"
                          disabled={retryMissedMutation.isPending && retryMissedMutation.variables === item.id}
                          onClick={() => retryMissedMutation.mutate(item.id)}
                        >
                          {retryMissedMutation.isPending && retryMissedMutation.variables === item.id
                            ? '重试中...'
                            : '重试'}
                        </button>
                      )}
                      {item.status !== 'ignored' && item.status !== 'matched' && (
                        <button className="text-xs text-amber-500 hover:underline" onClick={() => ignoreMissedMutation.mutate(item.id)}>忽略</button>
                      )}
                      {item.status !== 'pending' && (
                        <button className="text-xs text-green-500 hover:underline" onClick={() => resetMissedMutation.mutate(item.id)}>重置</button>
                      )}
                      <button className="text-xs text-red-500 hover:underline" onClick={() => { if (confirm('确定删除?')) deleteMissedMutation.mutate(item.id) }}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        current={missedPage}
        total={totalMissedPages}
        onPrev={() => setMissedPage(p => Math.max(1, p - 1))}
        onNext={() => setMissedPage(p => Math.min(totalMissedPages, p + 1))}
      />
    </SectionCard>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsLibrary() {
  const queryClient = useQueryClient()
  const toast = useToast()

  // Settings form
  const {
    s,
    isLoading: settingsLoading,
    mutation: settingsMutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  // Status
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['library-status'],
    queryFn: fetchLibraryStatus,
    refetchInterval: 5000,
  })

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: triggerLibrarySync,
    onSuccess: () => {
      toast.success('曲库同步任务已启动', '稍后会自动刷新曲库状态')
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
    },
    onError: (error: Error) => {
      toast.error('曲库同步启动失败', error.message)
    },
  })

  // Songs search
  const [songQuery, setSongQuery] = useState('')
  const [songPage, setSongPage] = useState(1)
  const { data: songsData, isLoading: songsLoading } = useQuery({
    queryKey: ['library-songs', songQuery, songPage],
    queryFn: () => fetchLibrarySongs(songQuery, songPage),
  })

  // Match logs
  const [logPage, setLogPage] = useState(1)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [logRetentionDays, setLogRetentionDays] = useState(30)
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['library-match-logs', logPage],
    queryFn: () => fetchMatchLogs(logPage),
  })

  // Clear old logs mutation
  const clearOldLogsMutation = useMutation({
    mutationFn: clearOldMatchLogs,
    onSuccess: (data: any) => {
      toast.success('日志已清理', data?.message || `已删除 ${logRetentionDays} 天前的日志`)
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
    },
    onError: (error: Error) => {
      toast.error('清理失败', error.message)
    },
  })

  // Manual matches
  const [manualPage, setManualPage] = useState(1)
  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [manualNavidromeId, setManualNavidromeId] = useState('')
  const [manualNote, setManualNote] = useState('')

  const { data: manualData, isLoading: manualLoading } = useQuery({
    queryKey: ['library-manual-matches', manualPage],
    queryFn: () => fetchManualMatches(manualPage),
  })

  const createManualMutation = useMutation({
    mutationFn: createManualMatch,
    onSuccess: () => {
      toast.success('人工匹配已保存')
      setManualTitle('')
      setManualArtist('')
      setManualNavidromeId('')
      setManualNote('')
      queryClient.invalidateQueries({ queryKey: ['library-manual-matches'] })
    },
    onError: (error: Error) => {
      toast.error('人工匹配保存失败', error.message)
    },
  })

  const deleteManualMutation = useMutation({
    mutationFn: deleteManualMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-manual-matches'] })
    },
  })

  const clearCacheMutation = useMutation({
    mutationFn: clearMatchCache,
    onSuccess: () => {
      toast.success('匹配缓存已清空')
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
    },
    onError: (error: Error) => {
      toast.error('清空缓存失败', error.message)
    },
  })

  // Clear low confidence cache
  const [cacheThreshold, setCacheThreshold] = useState(0.75)
  const clearLowConfidenceCacheMutation = useMutation({
    mutationFn: clearLowConfidenceCache,
    onSuccess: (data: any) => {
      toast.success('低置信度缓存已清除', data?.message)
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
    },
    onError: (error: Error) => {
      toast.error('清除失败', error.message)
    },
  })

  // Debug match
  const [debugTitle, setDebugTitle] = useState('')
  const [debugArtist, setDebugArtist] = useState('')
  const [debugThreshold, setDebugThreshold] = useState(0.75)

  const debugMutation = useMutation({
    mutationFn: debugMatch,
  })

  // Computed totals
  const totalSongPages = useMemo(() => {
    const total = Number((songsData as any)?.total || 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [songsData])

  const totalLogPages = useMemo(() => {
    const total = Number((logsData as any)?.total || 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [logsData])

  const totalManualPages = useMemo(() => {
    const total = Number((manualData as any)?.total || 0)
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [manualData])

  const cache = (status as any)?.cache || {}

  /* ── 移动端工具箱 Tabs ── */
  type ToolTab = 'status' | 'songs' | 'missed' | 'match' | 'manual' | 'logs'
  const [activeTool, setActiveTool] = useState<ToolTab>('status')

  const TOOL_TABS: { key: ToolTab; label: string; desc: string; icon: React.ElementType }[] = [
    { key: 'status', label: '状态概览', desc: '查看曲库、缓存和命中率', icon: Database },
    { key: 'songs', label: '搜索曲库', desc: '按歌名、艺术家、专辑搜索', icon: Search },
    { key: 'missed', label: '未命中歌曲', desc: '查看待补库和可重试歌曲', icon: AlertTriangle },
    { key: 'match', label: '匹配诊断', desc: '查看匹配链路和候选结果', icon: FileSearch },
    { key: 'manual', label: '人工匹配', desc: '固定错误匹配的对应关系', icon: UserCheck },
    { key: 'logs', label: '匹配日志', desc: '排查每次匹配的来源', icon: ScrollText },
  ]

  /* 工具箱 section 映射 */
  const toolSectionMap: Record<ToolTab, string> = {
    status: '曲库索引状态',
    songs: '歌曲搜索',
    missed: '未命中歌曲',
    match: '匹配诊断',
    manual: '人工匹配',
    logs: '匹配日志',
  }

  const isSectionVisible = (title: string) => {
    if (title === '调试设置') return activeTool === 'match'
    return toolSectionMap[activeTool] === title
  }

  return (
    <div className="space-y-3">

      {/* 工具箱入口卡片 */}
      <SectionCard
        title="曲库工具箱"
        description="选择一个工具查看详细内容。"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOL_TABS.map(tool => {
            const Icon = tool.icon
            const active = activeTool === tool.key

            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => setActiveTool(tool.key)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                    : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="mb-3 h-5 w-5" />
                <div className="text-sm font-semibold">{tool.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {tool.desc}
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>

      {/* ── 曲库索引状态 ── */}
      {isSectionVisible('曲库索引状态') && (
        <SectionCard title="曲库索引状态">
        {statusLoading ? (
          <div className="text-sm text-slate-500">加载曲库状态...</div>
        ) : statusError ? (
          <div className="text-sm text-red-500">加载失败: {(statusError as Error).message}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <StatusCard
                label="数据库歌曲"
                value={(status as any)?.total_songs ?? 0}
                desc="song_library 表中的歌曲数量"
              />
              <StatusCard
                label="内存缓存"
                value={cache.total_songs ?? 0}
                desc={cache.ready ? '已加载到内存索引' : '尚未就绪'}
              />
              <StatusCard
                label="缓存命中率"
                value={formatPercent(cache.hit_rate)}
                desc={`命中 ${cache.hits ?? 0} / 未命中 ${cache.misses ?? 0}`}
              />
              <StatusCard
                label="刷新状态"
                value={cache.refreshing ? '刷新中' : cache.ready ? '已就绪' : '未就绪'}
                desc={cache.last_full_refresh || '暂无刷新记录'}
              />
            </div>

            {cache.last_error && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 rounded-xl p-3 mt-3">
                最近错误: {cache.last_error}
              </div>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || cache.refreshing}
            className="btn-primary w-full sm:w-auto"
          >
            <RefreshCcw className="w-4 h-4" />
            {syncMutation.isPending ? '同步任务启动中...' : '同步 Navidrome 曲库'}
          </button>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['library-status'] })
              queryClient.invalidateQueries({ queryKey: ['library-songs'] })
              queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
            }}
            className="btn-secondary w-full sm:w-auto"
          >
            刷新页面数据
          </button>
        </div>

        </SectionCard>
      )}

      {/* ── 调试设置 ── */}
      {isSectionVisible('调试设置') && (
      <SectionCard title="调试设置">
        {settingsLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">加载调试设置...</div>
        ) : (
          <>
            <FieldInput
              fieldKey="match_debug_enabled"
              value={s.match_debug_enabled}
              onChange={(v) => handleChange('match_debug_enabled', v)}
            />

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3 text-xs text-amber-700 dark:text-amber-300">
              开启后，新产生的匹配日志会写入完整链路 steps，
              包括 manual_match、match_cache、memory、db_alias、db_fuzzy、subsonic 等步骤。
              该功能会增加 match_log.raw_json 的写入体积，建议仅在排查问题时开启。
            </div>

            <SaveBar
              hasChanges={hasChanges}
              isPending={settingsMutation.isPending}
              isSuccess={settingsMutation.isSuccess}
              isError={settingsMutation.isError}
              onSave={save}
            />
          </>
        )}
      </SectionCard>
      )}

      {/* ── 歌曲搜索 ── */}
      {isSectionVisible('歌曲搜索') && (
      <SectionCard title="歌曲搜索">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={songQuery}
              onChange={e => { setSongQuery(e.target.value); setSongPage(1) }}
              placeholder="搜索歌名、艺术家或专辑"
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => { setSongPage(1); queryClient.invalidateQueries({ queryKey: ['library-songs'] }) }}
            className="btn-secondary"
          >
            搜索
          </button>
        </div>

        <div className="card overflow-hidden mt-3">
          {songsLoading ? (
            <div className="p-4 text-sm text-slate-500">加载歌曲...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">歌曲</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">艺术家</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">专辑</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">来源</th>
                </tr>
              </thead>
              <tbody>
                {((songsData as any)?.items || []).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center"><EmptyState icon={Search} title="暂无歌曲" description="曲库索引为空，请先同步 Navidrome 曲库。" actionLabel="同步曲库" action={() => {}} /></td></tr>
                )}
                {((songsData as any)?.items || []).map((item: any) => (
                  <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="p-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{item.title}</div>
                      <div className="text-xs text-slate-400">Navidrome ID: {item.navidrome_id}</div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300 hidden md:table-cell">{item.artist || '-'}</td>
                    <td className="p-3 text-slate-400 hidden lg:table-cell">{item.album || '-'}</td>
                    <td className="p-3 hidden lg:table-cell">
                      <span className="badge-muted">
                        {labelOf(SONG_SOURCE_LABELS, item.source)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls
          current={songPage}
          total={totalSongPages}
          onPrev={() => setSongPage(p => Math.max(1, p - 1))}
          onNext={() => setSongPage(p => Math.min(totalSongPages, p + 1))}
        />
      </SectionCard>
      )}

      {/* ── 匹配诊断 ── */}
      {isSectionVisible('匹配诊断') && (
      <SectionCard title="匹配诊断">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          输入歌名和艺术家，查看标准化结果、别名、最终匹配来源和得分。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <input
            type="text"
            value={debugTitle}
            onChange={e => setDebugTitle(e.target.value)}
            placeholder="歌名，例如：如果呢"
            className="input"
          />
          <input
            type="text"
            value={debugArtist}
            onChange={e => setDebugArtist(e.target.value)}
            placeholder="艺术家，例如：郑润泽"
            className="input"
          />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              阈值：{Math.round(debugThreshold * 100)}%
            </div>
            <input
              type="range"
              min={50}
              max={95}
              value={Math.round(debugThreshold * 100)}
              onChange={e => setDebugThreshold(Number(e.target.value) / 100)}
              className="w-full accent-orange-500"
            />
          </div>
        </div>

        <button
          className="btn-primary mt-3"
          disabled={!debugTitle.trim() || debugMutation.isPending}
          onClick={() => debugMutation.mutate({ title: debugTitle, artist: debugArtist, threshold: debugThreshold })}
        >
          {debugMutation.isPending ? '诊断中...' : '开始诊断'}
        </button>

        {debugMutation.isError && (
          <p className="text-sm text-red-500 mt-2">诊断失败: {(debugMutation.error as Error).message}</p>
        )}

        {debugMutation.data && <DebugMatchResultView data={debugMutation.data} />}
      </SectionCard>
      )}

      {/* ── 人工匹配 ── */}
      {isSectionVisible('人工匹配') && (
      <SectionCard title="人工匹配">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          当某首歌自动匹配总是错误时，可以在这里固定输入歌曲与 Navidrome 歌曲 ID 的对应关系。
          后续匹配会优先使用 manual_match。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="输入歌名" className="input" />
          <input type="text" value={manualArtist} onChange={e => setManualArtist(e.target.value)} placeholder="输入艺术家（可选）" className="input" />
          <input type="text" value={manualNavidromeId} onChange={e => setManualNavidromeId(e.target.value)} placeholder="Navidrome 歌曲 ID" className="input" />
          <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="备注（可选）" className="input" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            className="btn-primary"
            disabled={createManualMutation.isPending || !manualTitle.trim() || !manualNavidromeId.trim()}
            onClick={() =>
              createManualMutation.mutate({
                input_title: manualTitle,
                input_artist: manualArtist,
                navidrome_id: manualNavidromeId,
                note: manualNote,
              })
            }
          >
            保存人工匹配
          </button>
          <button
            className="btn-danger"
            disabled={clearCacheMutation.isPending}
            onClick={() => {
              if (!confirm('确定清空全部自动匹配缓存吗？人工匹配不会被删除。')) return
              clearCacheMutation.mutate()
            }}
          >
            清空自动匹配缓存
          </button>
        </div>

        {/* 清除低置信度缓存 */}
        <div className="flex items-center gap-2 mt-3">
          <label className="text-xs text-slate-500 dark:text-slate-400">置信度低于</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={cacheThreshold}
            onChange={e => setCacheThreshold(Number(e.target.value))}
            className="input w-20"
          />
          <button
            className="btn-secondary"
            disabled={clearLowConfidenceCacheMutation.isPending}
            onClick={() => {
              if (!confirm(`确定清除所有置信度低于 ${Math.round(cacheThreshold * 100)}% 的缓存吗？`)) return
              clearLowConfidenceCacheMutation.mutate(cacheThreshold)
            }}
          >
            {clearLowConfidenceCacheMutation.isPending ? '清除中...' : '清除低置信度缓存'}
          </button>
        </div>

        <div className="card overflow-hidden mt-4">
          {manualLoading ? (
            <div className="p-4 text-sm text-slate-500">加载人工匹配...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">输入</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">Navidrome ID</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">备注</th>
                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {((manualData as any)?.items || []).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center"><EmptyState icon={UserCheck} title="暂无人工匹配" description="还没有人工匹配的歌曲。自动匹配无法命中的歌曲可以在诊断后手动关联。" /></td></tr>
                )}
                {((manualData as any)?.items || []).map((item: any) => (
                  <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="p-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{item.input_title}</div>
                      <div className="text-xs text-slate-400">{item.input_artist || '-'}</div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300 hidden md:table-cell">{item.navidrome_id}</td>
                    <td className="p-3 text-slate-400 hidden md:table-cell">{item.note || '-'}</td>
                    <td className="p-3 text-right">
                      <button
                        className="btn-danger"
                        disabled={deleteManualMutation.isPending}
                        onClick={() => {
                          if (!confirm('确定删除这条人工匹配吗？')) return
                          deleteManualMutation.mutate(item.id)
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls
          current={manualPage}
          total={totalManualPages}
          onPrev={() => setManualPage(p => Math.max(1, p - 1))}
          onNext={() => setManualPage(p => Math.min(totalManualPages, p + 1))}
        />
      </SectionCard>
      )}

      {/* ── 匹配日志 ── */}
      {isSectionVisible('匹配日志') && (
      <SectionCard title="匹配日志">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          排查推荐、热榜、歌单导入时的匹配来源和失败原因。
        </p>

        <div className="card overflow-hidden mt-3">
          {logsLoading ? (
            <div className="p-4 text-sm text-slate-500">加载日志...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">输入</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300">结果</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden md:table-cell">来源</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-300 hidden lg:table-cell">置信度</th>
                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {((logsData as any)?.items || []).length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center"><EmptyState icon={ScrollText} title="暂无匹配日志" description="执行推荐、热榜同步或歌单导入后，这里会显示匹配记录。" /></td></tr>
                )}
                {((logsData as any)?.items || []).map((item: any) => {
                  const hasRawJson = !!item.raw_json
                  const expanded = expandedLogId === item.id

                  return (
                    <Fragment key={item.id}>
                      <tr className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="p-3">
                          <div className="font-medium text-slate-900 dark:text-slate-50">{item.input_title}</div>
                          <div className="text-xs text-slate-400">{item.input_artist || '-'}</div>
                        </td>
                        <td className="p-3">
                          {item.matched ? (
                            <div>
                              <div className="text-green-600 dark:text-green-400 font-medium">命中</div>
                              <div className="text-xs text-slate-500">
                                {item.selected_title || '-'} — {item.selected_artist || '-'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-amber-600 dark:text-amber-400 font-medium">未命中</div>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="badge-muted">
                            {labelOf(MATCH_SOURCE_LABELS, item.source)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 hidden lg:table-cell">
                          {item.confidence_score != null
                            ? `${Math.round(Number(item.confidence_score) * 100)}%`
                            : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            disabled={!hasRawJson}
                            onClick={() => setExpandedLogId(expanded ? null : item.id)}
                            className={
                              hasRawJson
                                ? 'text-xs text-blue-500 hover:underline dark:text-blue-400'
                                : 'text-xs text-slate-400 cursor-not-allowed'
                            }
                          >
                            {expanded ? '收起详情' : '查看详情'}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="border-t border-border bg-slate-50/70 dark:bg-slate-950/40">
                          <td colSpan={5} className="p-3">
                            <DebugTraceView rawJson={item.raw_json} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <PaginationControls
          current={logPage}
          total={totalLogPages}
          onPrev={() => setLogPage(p => Math.max(1, p - 1))}
          onNext={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
        />

        {/* 清理旧日志 */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            min={1}
            max={365}
            value={logRetentionDays}
            onChange={e => setLogRetentionDays(Number(e.target.value))}
            className="input w-24"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">天前的日志</span>
          <button
            className="btn-secondary"
            disabled={clearOldLogsMutation.isPending}
            onClick={() => {
              if (!confirm(`确定删除 ${logRetentionDays} 天前的所有匹配日志吗？`)) return
              clearOldLogsMutation.mutate(logRetentionDays)
            }}
          >
            {clearOldLogsMutation.isPending ? '清理中...' : '清理'}
          </button>
        </div>
      </SectionCard>
      )}

      {/* ── 未命中歌曲 ── */}
      {isSectionVisible('未命中歌曲') && <MissedTracksCard />}

    </div>
  )
}
