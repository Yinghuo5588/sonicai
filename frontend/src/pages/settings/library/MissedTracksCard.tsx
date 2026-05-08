// frontend/src/pages/settings/library/MissedTracksCard.tsx

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { InfoGrid } from '@/components/ui'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui/useConfirm'
import { labelOf, MISSED_STATUS_LABELS } from '@/lib/labels'
import { SectionCard } from '../SettingsShared'
import {
  deleteMissedTrack,
  fetchMissedTrackStats,
  fetchMissedTracks,
  ignoreMissedTrack,
  resetMissedTrack,
  retryMissedTrack,
  retryMissedTracksBatch,
} from './libraryApi'
import { LIBRARY_PAGE_SIZE, MissedTrackStats, MissedTracksResponse } from './libraryTypes'
import PaginationControls from './components/PaginationControls'

export default function MissedTracksCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()

  const [status, setStatus] = useState('pending')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data: stats } = useQuery<MissedTrackStats>({
    queryKey: ['missed-track-stats'],
    queryFn: fetchMissedTrackStats as any,
  })

  const { data, isLoading } = useQuery<MissedTracksResponse>({
    queryKey: ['missed-tracks', status, query, page],
    queryFn: () => fetchMissedTracks(status, query, page) as any,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(data?.total) || 0) / LIBRARY_PAGE_SIZE)),
    [data],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['missed-tracks'] })
    queryClient.invalidateQueries({ queryKey: ['missed-track-stats'] })
  }

  const retryMutation = useMutation({
    mutationFn: retryMissedTrack,
    onSuccess: () => { toast.success('重试完成'); invalidate() },
    onError: (err: Error) => toast.error('重试失败', err.message),
  })

  const retryBatchMutation = useMutation({
    mutationFn: retryMissedTracksBatch,
    onSuccess: (res: any) => { toast.success('批量重试任务已启动', res?.message); invalidate() },
    onError: (err: Error) => toast.error('批量重试失败', err.message),
  })

  const ignoreMutation = useMutation({
    mutationFn: ignoreMissedTrack,
    onSuccess: () => { toast.success('已忽略'); invalidate() },
  })

  const resetMutation = useMutation({
    mutationFn: resetMissedTrack,
    onSuccess: () => { toast.success('已重置为待处理'); invalidate() },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMissedTrack,
    onSuccess: () => { toast.success('已删除'); invalidate() },
  })

  const items = data?.items || []

  return (
    <SectionCard title="未命中歌曲">
      <p className="text-xs text-slate-500 dark:text-slate-400">这里记录自动匹配未命中的歌曲。它是任务池，不是普通日志。同一首歌会自动去重并累计出现次数。补库后可手动或定时重试。</p>

      <InfoGrid
        columns={5}
        className="mt-3"
        items={[
          { label: '全部', value: stats?.total ?? 0 },
          { label: '待处理', value: stats?.pending ?? 0, tone: (stats?.pending ?? 0) > 0 ? 'warning' : 'default' },
          { label: '已匹配', value: stats?.matched ?? 0, tone: 'success' },
          { label: '失败', value: stats?.failed ?? 0, tone: (stats?.failed ?? 0) > 0 ? 'danger' : 'default' },
          { label: '已忽略', value: stats?.ignored ?? 0 },
        ]}
      />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="select sm:w-40">
          <option value="">全部</option>
          <option value="pending">待处理</option>
          <option value="matched">已匹配</option>
          <option value="failed">失败</option>
          <option value="ignored">已忽略</option>
        </select>
        <input type="text" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="搜索歌名或艺术家" className="input flex-1" />
        <button type="button" className="btn-secondary" disabled={retryBatchMutation.isPending} onClick={() => retryBatchMutation.mutate()}>
          {retryBatchMutation.isPending ? '启动中...' : '批量重试'}
        </button>
      </div>

      <div className="card mt-3 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">加载未命中歌曲...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left">歌曲</th>
                <th className="hidden p-3 text-left md:table-cell">状态</th>
                <th className="hidden p-3 text-left lg:table-cell">出现/重试</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center">
                    <EmptyState icon={AlertTriangle} title="暂无未命中歌曲" description="当前没有待处理的缺失歌曲，说明最近匹配状态良好。" />
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.artist || '-'}</div>
                    {item.last_error && <div className="mt-1 text-xs text-red-500">{item.last_error}</div>}
                  </td>
                  <td className="hidden p-3 md:table-cell"><span className="badge-muted">{labelOf(MISSED_STATUS_LABELS, item.status)}</span></td>
                  <td className="hidden p-3 text-slate-500 lg:table-cell">出现 {item.seen_count ?? 0} 次 · 重试 {item.retry_count ?? 0}/{item.max_retries ?? 5}</td>
                  <td className="p-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.status !== 'matched' && (
                        <button type="button" className="text-xs text-blue-500 hover:underline disabled:opacity-50"
                          disabled={retryMutation.isPending && retryMutation.variables === item.id}
                          onClick={() => retryMutation.mutate(item.id)}>
                          {retryMutation.isPending && retryMutation.variables === item.id ? '重试中...' : '重试'}
                        </button>
                      )}
                      {item.status !== 'ignored' && item.status !== 'matched' && (
                        <button type="button" className="text-xs text-amber-500 hover:underline" onClick={() => ignoreMutation.mutate(item.id)}>忽略</button>
                      )}
                      {item.status !== 'pending' && (
                        <button type="button" className="text-xs text-green-500 hover:underline" onClick={() => resetMutation.mutate(item.id)}>重置</button>
                      )}
                      <button type="button" className="text-xs text-red-500 hover:underline"
                        onClick={async () => {
                          const ok = await confirmDanger('确定删除这条未命中歌曲记录吗？', '删除未命中歌曲')
                          if (!ok) return
                          deleteMutation.mutate(item.id)
                        }}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls current={page} total={totalPages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))} />
    </SectionCard>
  )
}