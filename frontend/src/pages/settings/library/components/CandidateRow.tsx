// frontend/src/pages/settings/library/components/CandidateRow.tsx

export default function CandidateRow({ candidate, index }: { candidate: any; index: number }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 p-2 dark:bg-slate-950">
      <div className="flex items-start gap-2">
        <span className="font-mono text-slate-400">#{index}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-700 dark:text-slate-200">
            {candidate.title || '-'}
          </div>
          <div className="truncate text-slate-500 dark:text-slate-400">
            {candidate.artist || '-'}
          </div>
          {candidate.album && (
            <div className="truncate text-slate-400">专辑: {candidate.album}</div>
          )}
          {candidate.id && <div className="truncate text-slate-400">ID: {candidate.id}</div>}
          {candidate.query_label && (
            <div className="truncate text-slate-400">Query: {candidate.query_label}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-slate-700 dark:text-slate-200">
            {candidate.score != null ? Number(candidate.score).toFixed(4) : '-'}
          </div>
          <div className="text-slate-400">score</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
        {candidate.title_score != null && (
          <span>title: {Number(candidate.title_score).toFixed(3)}</span>
        )}
        {candidate.title_core_score != null && (
          <span>core: {Number(candidate.title_core_score).toFixed(3)}</span>
        )}
        {candidate.artist_score != null && (
          <span>artist: {Number(candidate.artist_score).toFixed(3)}</span>
        )}
        {candidate.pg_title_sim != null && (
          <span>pg_title: {Number(candidate.pg_title_sim).toFixed(3)}</span>
        )}
        {candidate.pg_artist_sim != null && (
          <span>pg_artist: {Number(candidate.pg_artist_sim).toFixed(3)}</span>
        )}
        {candidate.duration != null && <span>duration: {candidate.duration}s</span>}
      </div>
    </div>
  )
}