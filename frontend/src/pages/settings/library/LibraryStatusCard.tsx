// frontend/src/pages/settings/library/LibraryStatusCard.tsx

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { SectionCard } from '../SettingsShared'
import { fetchLibraryStatus, triggerLibrarySync } from './libraryApi'
import type { LibraryStatus } from './libraryTypes'

function StatusCard({ label, value, desc }: { label: string; value: React.ReactNode; desc?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">{value}</div>
      {desc && <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{desc}</div>}
    </div>
  )
}

export default function LibraryStatusCard() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading, error } = useQuery<LibraryStatus>({
    queryKey: ['library-status'],
    queryFn: fetchLibraryStatus as any,
    refetchInterval: 5000,
  })

  const cache = data?.cache || {}

  const syncMutation = useMutation({
    mutationFn: triggerLibrarySync,
    onSuccess: () => {
      toast.success('曲库同步任务已启动', '稍后会自动刷新曲库状态')
      queryClient.invalidateQueries({ queryKey: ['library-status'] })
      queryClient.invalidateQueries({ queryKey: ['library-songs'] })
    },
    onError: (err: Error) => toast.error('曲库同步启动失败', err.message),
  })

  return (
    <SectionCard
      title="曲库状态"
      description="当前曲库索引与缓存状态。"
      actions={
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || !!cache.refreshing}
          className="btn-primary"
        >
          <RefreshCcw className="h-4 w-4" />
          {syncMutation.isPending ? '同步启动中...' : '同步曲库'}
        </button>
      }
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">加载曲库状态...</div>
      ) : error ? (
        <div className="text-sm text-red-500">加载失败: {(error as Error).message}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatusCard label="数据库歌曲" value={data?.total_songs ?? 0} desc="song_library 表" />
            <StatusCard label="内存缓存" value={cache.total_songs ?? 0} desc={cache.ready ? '已就绪' : '未就绪'} />
            <StatusCard
              label="命中率"
              value={`${Math.round((cache.hit_rate || 0) * 100)}%`}
              desc={`命中 ${cache.hits ?? 0} / 未命中 ${cache.misses ?? 0}`}
            />
            <StatusCard
              label="刷新状态"
              value={cache.refreshing ? '刷新中' : cache.ready ? '已就绪' : '未就绪'}
              desc={cache.last_full_refresh || '暂无刷新记录'}
            />
          </div>
          {cache.last_error && (
            <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-500 dark:bg-red-950/40">
              最近错误: {cache.last_error}
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}