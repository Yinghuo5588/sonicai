import { useMemo } from 'react'

interface Props {
  title?: string
  seedCount: number
  similarPerSeed: number
  playlistSize: number
  balance: number
  threshold: number
  /** 用于相邻艺术家: seedCount * similarPerSeed * extraMultiplier */
  extraMultiplier?: number
  seedLabel?: string
  similarLabel?: string
  playlistLabel?: string
  unit?: string
}

export default function RecommendPreview({
  title = '推荐预览',
  seedCount,
  similarPerSeed,
  playlistSize,
  balance,
  threshold,
  extraMultiplier = 1,
  seedLabel = '种子数',
  similarLabel = '每种子获取',
  playlistLabel = '歌单大小',
  unit = '首',
}: Props) {
  const theoreticalMax = seedCount * similarPerSeed * extraMultiplier

  const candidatePool = useMemo(() => {
    const minMult = 2.0
    const maxMult = 10.0
    return Math.round(
      playlistSize * (minMult + (balance / 100) * (maxMult - minMult)),
    )
  }, [playlistSize, balance])

  const hitRate = useMemo(() => {
    if (threshold >= 0.85) return 0.30
    if (threshold >= 0.80) return 0.38
    if (threshold >= 0.75) return 0.45
    if (threshold >= 0.70) return 0.55
    return 0.65
  }, [threshold])

  const minHits = Math.min(Math.round(candidatePool * hitRate), playlistSize)

  const discardedPercent =
    theoreticalMax > 0
      ? Math.max(0, Math.round(((theoreticalMax - candidatePool) / theoreticalMax) * 100))
      : 0

  const wasteLevel =
    discardedPercent >= 70 ? '严重' : discardedPercent >= 30 ? '提醒' : '正常'

  const fillPercent =
    theoreticalMax > 0
      ? Math.min((candidatePool / theoreticalMax) * 100, 100)
      : 0

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-3 border border-blue-100 dark:border-blue-900 space-y-3 text-sm">
      <div>
        <div className="font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          根据当前参数估算候选规模和最终命中情况。
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-white/70 dark:bg-slate-950/40 p-2">
          <div className="text-slate-500">{seedLabel}</div>
          <div className="font-semibold mt-0.5">{seedCount}</div>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-slate-950/40 p-2">
          <div className="text-slate-500">{similarLabel}</div>
          <div className="font-semibold mt-0.5">
            {similarPerSeed}
            {extraMultiplier > 1 ? ` × ${extraMultiplier}` : ''}
          </div>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-slate-950/40 p-2">
          <div className="text-slate-500">{playlistLabel}</div>
          <div className="font-semibold mt-0.5">{playlistSize}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">理论获取</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {theoreticalMax} {unit}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">候选池</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {candidatePool} {unit}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">预估最低命中</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {minHits} {unit}
            {minHits === playlistSize ? '，已达歌单上限' : ''}
          </span>
        </div>
      </div>

      <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {wasteLevel === '严重' && (
        <p className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300">
          理论获取量中约有 {discardedPercent}% 不会进入候选池，可能丢弃较多候选。建议调高推荐平衡或增大歌单大小。
        </p>
      )}

      {wasteLevel === '提醒' && (
        <p className="text-xs px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300">
          理论获取量中约有 {discardedPercent}% 不会进入候选池，可按需调整推荐平衡。
        </p>
      )}
    </div>
  )
}