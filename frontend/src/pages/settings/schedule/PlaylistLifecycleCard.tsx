// frontend/src/pages/settings/schedule/PlaylistLifecycleCard.tsx

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui/useConfirm'
import { FieldInput, SectionCard } from '../SettingsShared'
import { fetchRetentionPolicies, previewPlaylistCleanup, runPlaylistCleanup, updateRetentionPolicy } from './scheduleApi'
import type { PlaylistCleanupPreviewResponse, PlaylistRetentionPoliciesResponse, ScheduleCardProps } from './scheduleTypes'

const TYPE_LABELS: Record<string, string> = {
  similar_tracks: 'Last.fm 相似曲目',
  similar_artists: 'Last.fm 相邻艺术家',
  hotboard: '网易云热榜',
  ai_recommendation: 'AI 推荐歌单',
  playlist_netease: '第三方歌单',
  playlist_text: '文本歌单',
  playlist_incremental: '歌单链接增量同步',
}

function RetentionPoliciesTable() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PlaylistRetentionPoliciesResponse>({
    queryKey: ['playlist-retention-policies'],
    queryFn: fetchRetentionPolicies as any,
  })

  const updatePolicyMutation = useMutation({
    mutationFn: ({ type, payload }: { type: string; payload: Record<string, unknown> }) => updateRetentionPolicy(type, payload),
    onSuccess: () => { toast.success('保留策略已更新'); queryClient.invalidateQueries({ queryKey: ['playlist-retention-policies'] }) },
    onError: (err: any) => toast.error('策略更新失败', err?.detail || err?.message || '未知错误'),
  })

  const policies = data?.items || []

  const updatePolicyField = (row: any, key: string, value: unknown) => {
    updatePolicyMutation.mutate({
      type: row.playlist_type,
      payload: {
        enabled: key === 'enabled' ? value : row.enabled,
        keep_days: key === 'keep_days' ? Number(value) : row.keep_days,
        delete_navidrome: key === 'delete_navidrome' ? value : row.delete_navidrome,
        keep_recent_success_count: key === 'keep_recent_success_count' ? Number(value) : row.keep_recent_success_count,
      },
    })
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
      <div className="bg-slate-50 p-3 text-sm font-semibold dark:bg-slate-900">按歌单类型保留策略</div>
      {isLoading ? (
        <div className="p-3 text-sm text-slate-500">加载策略...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-3 text-left">歌单类型</th>
                <th className="p-3 text-left">自动清理</th>
                <th className="p-3 text-left">保留天数</th>
                <th className="p-3 text-left">删除 Navidrome</th>
                <th className="p-3 text-left">最近保留</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(row => (
                <tr key={row.playlist_type} className="border-t border-border">
                  <td className="p-3 font-medium">{TYPE_LABELS[row.playlist_type] ?? row.playlist_type}</td>
                  <td className="p-3">
                    <input type="checkbox" checked={!!row.enabled} onChange={e => updatePolicyField(row, 'enabled', e.target.checked)} className="h-4 w-4 accent-cyan-500" />
                  </td>
                  <td className="p-3">
                    <input type="number" min={0} max={3650} value={Number(row.keep_days ?? 0)} onChange={e => updatePolicyField(row, 'keep_days', Number(e.target.value))} className="input w-24" />
                  </td>
                  <td className="p-3">
                    <input type="checkbox" checked={!!row.delete_navidrome} onChange={e => updatePolicyField(row, 'delete_navidrome', e.target.checked)} className="h-4 w-4 accent-red-500" />
                  </td>
                  <td className="p-3">
                    <input type="number" min={0} max={20} value={Number(row.keep_recent_success_count ?? 0)} onChange={e => updatePolicyField(row, 'keep_recent_success_count', Number(e.target.value))} className="input w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CleanupPreview({ preview }: { preview: PlaylistCleanupPreviewResponse }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
      <div className="bg-slate-50 p-3 text-sm font-semibold dark:bg-slate-900">预计清理 {preview.total ?? 0} 个歌单</div>
      {preview.by_type && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(preview.by_type).map(([type, count]) => (
              <span key={type} className="badge-muted">{TYPE_LABELS[type] ?? type}: {String(count)}</span>
            ))}
          </div>
          {preview.operation_stats && (
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-xl bg-red-50 p-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">预计删除 Navidrome: {preview.operation_stats.delete_navidrome_count ?? 0}</div>
              <div className="rounded-xl bg-slate-50 p-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">仅清空本地关联: {preview.operation_stats.clear_local_only_count ?? 0}</div>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">跳过失败任务: {preview.operation_stats.skip_failed_count ?? 0}</div>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">最近保留跳过: {preview.operation_stats.skip_recent_keep_count ?? 0}</div>
            </div>
          )}
          {(preview.operation_stats?.delete_navidrome_count ?? 0) > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              本次操作会删除 Navidrome 中的远端歌单。删除后无法从 SonicAI 恢复，只能重新生成。
            </div>
          )}
        </div>
      )}
      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {(preview.items || []).length === 0 && (
          <div className="p-4 text-sm text-slate-500">当前没有需要清理的过期歌单。</div>
        )}
        {(preview.items || []).map(item => (
          <div key={item.playlist_id} className="p-3 text-sm">
            <div className="font-medium text-slate-800 dark:text-slate-100">{item.playlist_name}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              类型: {TYPE_LABELS[item.playlist_type] ?? item.playlist_type} · 创建: {item.created_at || '-'} · 保留: {item.keep_days ?? '-'} 天
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">原因: {item.reason}</div>
            <div className="mt-1 text-xs text-slate-400">
              Navidrome ID: {item.navidrome_playlist_id || '-'} · {item.delete_navidrome ? '会删除远端歌单' : '仅清空本地关联'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PlaylistLifecycleCard({ s, handleChange }: ScheduleCardProps) {
  const toast = useToast()
  const { confirmDanger } = useConfirm()
  const [preview, setPreview] = useState<PlaylistCleanupPreviewResponse | null>(null)

  const previewMutation = useMutation({
    mutationFn: previewPlaylistCleanup,
    onSuccess: (data: any) => { setPreview(data); toast.info('清理预览已生成', `预计清理 ${data?.total ?? 0} 个歌单`) },
    onError: (err: any) => toast.error('清理预览失败', err?.detail || err?.message || '未知错误'),
  })

  const runMutation = useMutation({
    mutationFn: runPlaylistCleanup,
    onSuccess: (data: any) => { toast.success('歌单清理完成', `扫描 ${data?.scanned ?? 0} 个，更新 ${data?.updated_local_count ?? 0} 个`); setPreview(null) },
    onError: (err: any) => toast.error('歌单清理失败', err?.detail || err?.message || '未知错误'),
  })

  return (
    <SectionCard title="歌单生命周期">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">控制 SonicAI 创建的 Navidrome 歌单保留策略。</p>
      <FieldInput fieldKey="playlist_cleanup_enabled" value={s.playlist_cleanup_enabled} onChange={v => handleChange('playlist_cleanup_enabled', v)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput fieldKey="playlist_cleanup_cron" value={s.playlist_cleanup_cron ?? '30 3 * * *'} onChange={v => handleChange('playlist_cleanup_cron', v)} />
        <FieldInput fieldKey="playlist_keep_days" value={s.playlist_keep_days} onChange={v => handleChange('playlist_keep_days', v)} />
      </div>
      <FieldInput fieldKey="playlist_cleanup_delete_navidrome" value={s.playlist_cleanup_delete_navidrome} onChange={v => handleChange('playlist_cleanup_delete_navidrome', v)} />
      <FieldInput fieldKey="playlist_cleanup_keep_failed" value={s.playlist_cleanup_keep_failed} onChange={v => handleChange('playlist_cleanup_keep_failed', v)} />
      <FieldInput fieldKey="playlist_cleanup_keep_recent_success_count" value={s.playlist_cleanup_keep_recent_success_count} onChange={v => handleChange('playlist_cleanup_keep_recent_success_count', v)} />
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        注意：如果开启「同时删除 Navidrome 歌单」，清理时会调用 Navidrome 删除远端歌单。建议首次使用前先点击「预览清理」确认列表。
      </div>
      <RetentionPoliciesTable />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-secondary" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
          {previewMutation.isPending ? '预览中...' : '预览清理'}
        </button>
        <button
          type="button" className="btn-danger" disabled={runMutation.isPending}
          onClick={async () => {
            const message = s.playlist_cleanup_delete_navidrome
              ? '确定立即清理过期歌单吗？当前设置会同时删除 Navidrome 中的远端歌单。'
              : '确定立即清理过期歌单吗？当前设置不会删除 Navidrome 远端歌单，只会清空 SonicAI 中的歌单 ID。'
            const ok = await confirmDanger(message, '立即清理过期歌单')
            if (!ok) return
            runMutation.mutate()
          }}
        >
          {runMutation.isPending ? '清理中...' : '立即清理'}
        </button>
      </div>
      {preview && <CleanupPreview preview={preview} />}
    </SectionCard>
  )
}