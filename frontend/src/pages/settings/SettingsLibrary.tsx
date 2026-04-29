import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { SectionCard } from './SettingsShared'
import { RefreshCcw, Search, Activity } from 'lucide-react'

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

async function debugMatch(payload: { title: string; artist?: string; threshold: number }) {
  return apiFetch('/library/debug-match', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsLibrary() {
  const queryClient = useQueryClient()

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
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
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
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['library-match-logs', logPage],
    queryFn: () => fetchMatchLogs(logPage),
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
      setManualTitle('')
      setManualArtist('')
      setManualNavidromeId('')
      setManualNote('')
      queryClient.invalidateQueries({ queryKey: ['library-manual-matches'] })
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
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-match-logs'] })
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

  return (
    <div className="space-y-4">

      {/* ── 曲库索引状态 ── */}
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
                value={
                  cache.refreshing ? '刷新中' : cache.ready ? '已就绪' : '未就绪'
                }
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

        {syncMutation.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">曲库同步任务已启动，稍后会自动刷新状态。</p>
        )}
        {syncMutation.isError && (
          <p className="text-sm text-red-500 mt-2">曲库同步失败: {(syncMutation.error as Error).message}</p>
        )}
      </SectionCard>

      {/* ── 歌曲搜索 ── */}
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
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">暂无歌曲</td></tr>
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
                      <span className="badge-muted">{item.source || '-'}</span>
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

      {/* ── 匹配诊断 ── */}
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

        {debugMutation.data && (
          <pre className="mt-3 text-xs overflow-x-auto rounded-xl bg-slate-950 text-slate-100 p-3">
            {JSON.stringify(debugMutation.data, null, 2)}
          </pre>
        )}
      </SectionCard>

      {/* ── 人工匹配 ── */}
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

        {createManualMutation.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">人工匹配已保存。</p>
        )}
        {createManualMutation.isError && (
          <p className="text-sm text-red-500 mt-2">保存失败: {(createManualMutation.error as Error).message}</p>
        )}

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
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">暂无人工匹配</td></tr>
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

      {/* ── 匹配日志 ── */}
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
                </tr>
              </thead>
              <tbody>
                {((logsData as any)?.items || []).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">暂无匹配日志</td></tr>
                )}
                {((logsData as any)?.items || []).map((item: any) => (
                  <tr key={item.id} className="border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900">
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
                      <span className="badge-muted">{item.source || '-'}</span>
                    </td>
                    <td className="p-3 text-slate-500 hidden lg:table-cell">
                      {item.confidence_score != null
                        ? `${Math.round(Number(item.confidence_score) * 100)}%`
                        : '-'}
                    </td>
                  </tr>
                ))}
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
      </SectionCard>

    </div>
  )
}