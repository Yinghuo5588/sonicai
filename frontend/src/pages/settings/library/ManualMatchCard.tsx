// frontend/src/pages/settings/library/ManualMatchCard.tsx

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui/useConfirm'
import { SectionCard } from '../SettingsShared'
import {
  clearLowConfidenceCache,
  clearMatchCache,
  createManualMatch,
  deleteManualMatch,
  fetchManualMatches,
} from './libraryApi'
import { LIBRARY_PAGE_SIZE, ManualMatchesResponse } from './libraryTypes'
import PaginationControls from './components/PaginationControls'

export default function ManualMatchCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()

  const [page, setPage] = useState(1)
  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [manualNavidromeId, setManualNavidromeId] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [cacheThreshold, setCacheThreshold] = useState(0.75)

  const { data, isLoading } = useQuery<ManualMatchesResponse>({
    queryKey: ['library-manual-matches', page],
    queryFn: () => fetchManualMatches(page) as any,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(data?.total) || 0) / LIBRARY_PAGE_SIZE)),
    [data],
  )

  const createMutation = useMutation({
    mutationFn: createManualMatch,
    onSuccess: () => {
      toast.success('人工匹配已保存')
      setManualTitle(''); setManualArtist(''); setManualNavidromeId(''); setManualNote('')
      queryClient.invalidateQueries({ queryKey: ['library-manual-matches'] })
    },
    onError: (err: Error) => toast.error('人工匹配保存失败', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteManualMatch,
    onSuccess: () => {
      toast.success('人工匹配已删除')
      queryClient.invalidateQueries({ queryKey: ['library-manual-matches'] })
    },
    onError: (err: Error) => toast.error('删除失败', err.message),
  })

  const clearCacheMutation = useMutation({
    mutationFn: clearMatchCache,
    onSuccess: () => {
      toast.success('匹配缓存已清空')
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
    },
    onError: (err: Error) => toast.error('清空缓存失败', err.message),
  })

  const clearLowConfidenceCacheMutation = useMutation({
    mutationFn: clearLowConfidenceCache,
    onSuccess: (res: any) => {
      toast.success('低置信度缓存已清除', res?.message)
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
    },
    onError: (err: Error) => toast.error('清除失败', err.message),
  })

  const items = data?.items || []

  return (
    <SectionCard title="人工匹配">
      <p className="text-xs text-slate-500 dark:text-slate-400">当某首歌自动匹配总是错误时，可以在这里固定输入歌曲与 Navidrome 歌曲 ID 的对应关系。后续匹配会优先使用 manual_match。</p>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="输入歌名" className="input" />
        <input type="text" value={manualArtist} onChange={e => setManualArtist(e.target.value)} placeholder="输入艺术家，可选" className="input" />
        <input type="text" value={manualNavidromeId} onChange={e => setManualNavidromeId(e.target.value)} placeholder="Navidrome 歌曲 ID" className="input" />
        <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="备注，可选" className="input" />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button" className="btn-primary"
          disabled={createMutation.isPending || !manualTitle.trim() || !manualNavidromeId.trim()}
          onClick={() => createMutation.mutate({ input_title: manualTitle, input_artist: manualArtist, navidrome_id: manualNavidromeId, note: manualNote })}
        >
          保存人工匹配
        </button>
        <button
          type="button" className="btn-danger" disabled={clearCacheMutation.isPending}
          onClick={async () => {
            const ok = await confirmDanger('确定清空全部自动匹配缓存吗？人工匹配不会被删除。', '清空自动匹配缓存')
            if (!ok) return
            clearCacheMutation.mutate()
          }}
        >
          清空自动匹配缓存
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500 dark:text-slate-400">置信度低于</label>
        <input type="number" min={0} max={1} step={0.05} value={cacheThreshold} onChange={e => setCacheThreshold(Number(e.target.value))} className="input w-24" />
        <button
          type="button" className="btn-secondary" disabled={clearLowConfidenceCacheMutation.isPending}
          onClick={async () => {
            const ok = await confirmDanger(`确定清除所有置信度低于 ${Math.round(cacheThreshold * 100)}% 的缓存吗？`, '清除低置信度缓存')
            if (!ok) return
            clearLowConfidenceCacheMutation.mutate(cacheThreshold)
          }}
        >
          {clearLowConfidenceCacheMutation.isPending ? '清除中...' : '清除低置信度缓存'}
        </button>
      </div>

      <div className="card mt-4 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">加载人工匹配...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">输入</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 md:table-cell">Navidrome ID</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 md:table-cell">备注</th>
                <th className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center">
                    <EmptyState icon={UserCheck} title="暂无人工匹配" description="还没有人工匹配的歌曲。" />
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{item.input_title}</div>
                    <div className="text-xs text-slate-400">{item.input_artist || '-'}</div>
                  </td>
                  <td className="hidden p-3 text-slate-600 dark:text-slate-300 md:table-cell">{item.navidrome_id}</td>
                  <td className="hidden p-3 text-slate-400 md:table-cell">{item.note || '-'}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button" className="btn-danger" disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirmDanger('确定删除这条人工匹配吗？', '删除人工匹配')
                        if (!ok) return
                        deleteMutation.mutate(item.id)
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

      <PaginationControls current={page} total={totalPages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(totalPages, p + 1))} />
    </SectionCard>
  )
}