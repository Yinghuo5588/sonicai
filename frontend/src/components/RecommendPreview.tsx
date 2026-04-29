import { useMemo } from 'react';

interface Props {
  seedCount: number;
  similarPerSeed: number;
  playlistSize: number;
  balance: number;
  threshold: number;
}

export default function RecommendPreview({
  seedCount,
  similarPerSeed,
  playlistSize,
  balance,
  threshold,
}: Props) {
  const theoreticalMax = seedCount * similarPerSeed;

  const candidatePool = useMemo(() => {
    const minMult = 2.0;
    const maxMult = 10.0;
    return Math.round(playlistSize * (minMult + (balance / 100) * (maxMult - minMult)));
  }, [playlistSize, balance]);

  const hitRate = useMemo(() => {
    if (threshold >= 0.85) return 0.30;
    if (threshold >= 0.80) return 0.38;
    if (threshold >= 0.75) return 0.45;
    if (threshold >= 0.70) return 0.55;
    return 0.65;
  }, [threshold]);

  const minHits = Math.min(Math.round(candidatePool * hitRate), playlistSize);

  const wastePercent = theoreticalMax > 0
    ? Math.round((theoreticalMax - candidatePool) / theoreticalMax * 100)
    : 0;

  const wasteLevel = wastePercent >= 70 ? '严重' : wastePercent >= 30 ? '提醒' : '正常';

  const fillPercent = theoreticalMax > 0
    ? Math.min((candidatePool / theoreticalMax) * 100, 100)
    : 0;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-600 dark:text-slate-400">理论获取</span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{theoreticalMax} 首</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 dark:text-slate-400">候选池</span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{candidatePool} 首</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-600 dark:text-slate-400">最低命中</span>
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {minHits} 首{minHits === playlistSize ? ' (已达歌单上限)' : ''}
        </span>
      </div>

      <div className="w-full bg-blue-100 dark:bg-blue-900 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {wasteLevel === '严重' && (
        <p className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300">
          候选池仅占获取量的 {wastePercent}%，大量相似曲目将被丢弃，建议调高推荐平衡或增大歌单大小
        </p>
      )}
      {wasteLevel === '提醒' && (
        <p className="text-xs px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300">
          候选池为获取量的 {wastePercent}%，可适当调整参数以充分利用数据
        </p>
      )}
    </div>
  );
}
