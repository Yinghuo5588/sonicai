// frontend/src/pages/settings/library/MatchLogsCard.tsx

import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui/useConfirm'
import { labelOf, MATCH_SOURCE_LABELS } from '@/lib/labels'
import { SectionCard } from '../SettingsShared'
import { clearOldMatchLogs, fetchMatchLogs } from './libraryApi'
import { LIBRARY_PAGE_SIZE, MatchLogsResponse } from './libraryTypes'
import PaginationControls from './components/PaginationControls'
import DebugTraceView from './components/DebugTraceView'

export default function MatchLogsCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()

  const [page, setPage] = useState(1)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [retentionDays, setRetentionDays] = useState(30)

  const { data, isLoading } = useQuery<MatchLogsResponse>({
    queryKey: ['library-match-logs', page],
    queryFn: () => fetchMatchLogs(page) as any,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(data?.total) || 0) / LIBRARY_PAGE_SIZE)),
    [data],
  )

  const clearOldLogsMutation = useMutation({
    mutationFn: clearOldMatchLogs,
    onSuccess: (res: any) => {
      toast.success('日志已清理', res?.message || `已删除 ${retentionDays} 天前的日志`)
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
    },
    onError: (err: Error) => toast.error('清理失败', err.message),
  })

  const items = data?.items || []

  return (
    <SectionCard title="匹配日志">
      <p className="text-xs text-slate-500 dark:text-slate-400">排查推荐、热榜、歌单导入时的匹配来源和失败原因。</p>

      <div className="card mt-3 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">加载日志...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">输入</th>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">结果</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 md:table-cell">来源</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">置信度</th>
                <th className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    <EmptyState icon={ScrollText} title="暂无匹配日志" description="执行推荐、热榜同步或歌单导入后，这里会显示匹配记录。" />
                  </td>
                </tr>
              )}
              {items.map(item => {
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
                            <div className="font-medium text-green-600 dark:text-green-400">命中</div>
                            <div className="text-xs text-slate-500">{item.selected_title || '-'} — {item.selected_artist || '-'}</div>
                          </div>
                        ) : (
                          <div className="font-medium text-amber-600 dark:text-amber-400">未命中</div>
                        )}
                      </td>
                      <td className="hidden p-3 md:table-cell"><span className="badge-muted">{labelOf(MATCH_SOURCE_LABELS, item.source)}</span></td>
                      <td className="hidden p-3 text-slate-500 lg:table-cell">
                        {item.confidence_score != null ? `${Math.round(Number(item.confidence_score) * 100)}%` : '-'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button" disabled={!hasRawJson}
                          onClick={() => setExpandedLogId(expanded ? null : item.id)}
                          className={hasRawJson ? 'text-xs text-blue-500 hover:underline dark:text-blue-400' : 'cursor-not-allowed text-xs text-slate-400'}
                        >
                          {expanded ? '收起详情' : '查看详情'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-border bg-slate-50/70 dark:bg-slate-950/40">
                        <td colSpan={5} className="p-3"><DebugTraceView rawJson={item.raw_json} /></td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls current={page} total={totalPages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={365} value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} className="input w-24" />
        <span className="text-xs text-slate-500 dark:text-slate-400">天前的日志</span>
        <button
          type="button" className="btn-secondary" disabled={clearOldLogsMutation.isPending}
          onClick={async () => {
            const ok = await confirmDanger(`确定删除 ${retentionDays} 天前的所有匹配日志吗？`, '清理匹配日志')
            if (!ok) return
            clearOldLogsMutation.mutate(retentionDays)
          }}
        >
          {clearOldLogsMutation.isPending ? '清理中...' : '清理'}
        </button>
      </div>
    </SectionCard>
  )
}