// frontend/src/pages/settings/library/LibrarySongsCard.tsx

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { labelOf, SONG_SOURCE_LABELS } from '@/lib/labels'
import { SectionCard } from '../SettingsShared'
import { fetchLibrarySongs } from './libraryApi'
import { LIBRARY_PAGE_SIZE, LibrarySongsResponse } from './libraryTypes'
import PaginationControls from './components/PaginationControls'

export default function LibrarySongsCard() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<LibrarySongsResponse>({
    queryKey: ['library-songs', query, page],
    queryFn: () => fetchLibrarySongs(query, page) as any,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((Number(data?.total) || 0) / LIBRARY_PAGE_SIZE)),
    [data],
  )

  const items = data?.items || []

  return (
    <SectionCard title="歌曲搜索">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="搜索歌名、艺术家或专辑"
            className="input pl-9"
          />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { setPage(1); queryClient.invalidateQueries({ queryKey: ['library-songs'] }) }}
        >
          搜索
        </button>
      </div>

      <div className="card mt-3 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">加载歌曲...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">歌曲</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 md:table-cell">艺术家</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">专辑</th>
                <th className="hidden p-3 text-left font-medium text-slate-600 dark:text-slate-300 lg:table-cell">来源</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center">
                    <EmptyState
                      icon={Search}
                      title="暂无歌曲"
                      description="曲库索引为空，请先同步 Navidrome 曲库。"
                    />
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{item.title}</div>
                    <div className="text-xs text-slate-400">Navidrome ID: {item.navidrome_id}</div>
                  </td>
                  <td className="hidden p-3 text-slate-600 dark:text-slate-300 md:table-cell">{item.artist || '-'}</td>
                  <td className="hidden p-3 text-slate-400 lg:table-cell">{item.album || '-'}</td>
                  <td className="hidden p-3 lg:table-cell">
                    <span className="badge-muted">{labelOf(SONG_SOURCE_LABELS, item.source)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        current={page}
        total={totalPages}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
      />
    </SectionCard>
  )
}