import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import apiFetch from '@/lib/api'
import { useToast } from '@/components/ui/useToast'
import {
  LIBRARY_MODE_LABELS,
  MATCH_MODE_LABELS,
  SEED_SOURCE_MODE_LABELS,
  TOP_PERIOD_LABELS,
  MISSED_RETRY_MODE_LABELS,
  RECOMMENDATION_CRON_RUN_TYPE_LABELS,
  labelOf,
} from '@/lib/labels'
import type { Settings } from '@/types/api'

export async function fetchSettings(): Promise<Settings> {
  return apiFetch('/settings') as Promise<Settings>
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }) as Promise<void>
}

export async function testNavidrome() {
  return apiFetch('/settings/test-navidrome', { method: 'POST' })
}

export async function testWebhook() {
  return apiFetch('/settings/test-webhook', { method: 'POST' })
}

export const FIELD_LABELS: Record<string, { label: string; type?: string; tooltip: string }> = {
  library_mode_default: {
    label: '推荐模式',
    type: 'select',
    tooltip:
      '▸ 控制缺失歌曲的处理方式\n' +
      ' 默认：library_only  可选：allow_missing\n' +
      ' · library_only — 只保留库内能匹配的歌曲\n' +
      ' · allow_missing — 无法匹配的通过 Webhook 通知',
  },
  recommendation_balance: {
    label: '推荐平衡',
    type: 'slider',
    tooltip:
      '▸ 探索新歌 vs 保守听熟曲的程度\n' +
      ' 0 → 极致保守（命中率最高）\n' +
      ' 100 → 极致探索（缺失可能增加）',
  },
  top_track_seed_limit: {
    label: '种子曲目数',
    type: 'number',
    tooltip:
      '▸ 从 Last.fm 热门中取多少首作为种子\n' +
      ' 默认：30  推荐：15 - 50',
  },
  top_artist_seed_limit: {
    label: '种子艺术家数',
    type: 'number',
    tooltip:
      '▸ 相邻艺术家歌单的种子艺人数量\n' +
      ' 默认：30  推荐：10 - 40',
  },
  similar_track_limit: {
    label: '每曲相似曲目数',
    type: 'number',
    tooltip:
      '▸ 每个种子从 Last.fm 获取多少相似歌曲\n' +
      ' 默认：30  推荐：20 - 50',
  },
  similar_artist_limit: {
    label: '每种子取相似艺术家数',
    type: 'number',
    tooltip:
      '▸ 每个种子艺人获取多少位相似艺人\n' +
      ' 默认：30  推荐：10 - 30',
  },
  artist_top_track_limit: {
    label: '每相似艺术家热门歌曲',
    type: 'number',
    tooltip:
      '▸ 每个相似艺人取多少首热门歌\n' +
      ' 默认：2  推荐：1 - 5',
  },
  similar_playlist_size: {
    label: '相似曲目歌单大小',
    type: 'number',
    tooltip:
      '▸ 最终相似曲目歌单的最大歌曲数\n' +
      ' 默认：30  推荐：30 - 100',
  },
  artist_playlist_size: {
    label: '相邻艺术家歌单大小',
    type: 'number',
    tooltip:
      '▸ 最终相邻艺术家歌单的最大歌曲数\n' +
      ' 默认：30  推荐：30 - 100',
  },
  duplicate_avoid_days: {
    label: '去重天数',
    type: 'number',
    tooltip:
      '▸ 同一首歌多少天内不会再次推荐\n' +
      ' 默认：14  推荐：7 - 30',
  },
  match_debug_enabled: {
    label: '匹配调试模式',
    type: 'boolean',
    tooltip:
      '▸ 开启后，每次匹配都会记录详细的链路诊断信息到匹配日志。\n' +
      '⚠️ 会增加 raw_json 写入量，建议仅在排查问题时开启。',
  },
  seed_source_mode: {
    label: '种子来源模式',
    type: 'select',
    tooltip:
      '▸ 从哪里选取推荐种子\n' +
      ' · recent_only — 仅最近播放\n' +
      ' · top_only — 仅历史排行\n' +
      ' · recent_plus_top — 两者混合',
  },
  top_period: {
    label: 'Top 数据周期',
    type: 'select',
    tooltip:
      '▸ Last.fm 历史排行榜的统计周期\n' +
      ' 默认：1month  推荐：1month - 3month',
  },
  recent_tracks_limit: {
    label: 'Recent Tracks 抓取条数',
    type: 'number',
    tooltip:
      '▸ 抓取最近播放记录的数量（仅影响统计窗口）\n' +
      ' 默认：100  推荐：100 - 500',
  },
  recent_top_mix_ratio: {
    label: 'Recent/Top 混合比例',
    type: 'slider',
    tooltip:
      '▸ 种子中「最近播放」的占比\n' +
      ' 70 → 70% 来自最近播放，30% 来自历史排行',
  },
  match_threshold: {
    label: '匹配阈值',
    type: 'slider',
    tooltip:
      '▸ 匹配 Navidrome 歌曲的最低相似度\n' +
      ' 默认：0.75  推荐：0.70 - 0.85',
  },
  match_mode: {
    label: '匹配模式',
    type: 'select',
    tooltip:
      '▸ 控制本地未命中后是否继续请求 Navidrome/Subsonic\n' +
      ' · full — 完整匹配,包含 Subsonic 实时兜底\n' +
      ' · local — 仅本地索引, api — 仅 Subsonic, full — 本地+Subsonic 完整匹配',
  },
  missed_track_retry_enabled: {
    label: '启用缺失歌曲定时重试',
    type: 'boolean',
    tooltip:
      '▸ 定时重试 missed_tracks 中 pending 的歌曲。\n' +
      ' 建议补库后开启,任务会尝试在本地索引中重新匹配。',
  },
  missed_track_retry_limit: {
    label: '每次重试数量',
    type: 'number',
    tooltip:
      '▸ 每次定时任务最多处理多少首缺失歌曲。\n' +
      ' 默认 100,建议 50 - 200。',
  },
  missed_track_retry_refresh_library: {
    label: '重试前刷新曲库索引',
    type: 'boolean',
    tooltip:
      '▸ 开启后,重试前会先同步 Navidrome 曲库并刷新内存缓存。\n' +
      ' 如果你补库后希望自动命中,建议开启。',
  },
  missed_track_retry_mode: {
    label: '重试模式',
    type: 'select',
    tooltip:
      '▸ 定时或手动批量重试使用的匹配方式\n' +
      ' · local — 刷新全库后本地匹配（适合大量补库）\n' +
      ' · api — 直接用 Subsonic 实时搜索（适合少量补库）',
  },
  search_concurrency: {
    label: '搜索并发数',
    type: 'number',
    tooltip:
      '▸ 同时向 Navidrome 发起的搜索请求数\n' +
      ' 默认：5  推荐：3 - 10',
  },
  playlist_keep_days: {
    label: '默认歌单保留天数',
    type: 'number',
    tooltip:
      '▸ SonicAI 创建的歌单默认保留多少天\n' +
      ' 用于歌单生命周期自动清理\n' +
      ' 0 = 永不过期',
  },
  history_cleanup_enabled: {
    label: '启用历史自动清理',
    type: 'boolean',
    tooltip:
      '▸ 开启后,系统每天自动清理超过保留天数的推荐历史和 Webhook 记录。\n' +
      ' 默认关闭,避免升级后误删历史数据。',
  },
  run_history_keep_days: {
    label: '推荐历史保留天数',
    type: 'number',
    tooltip:
      '▸ 推荐历史在 SonicAI 数据库中保留多少天。\n' +
      ' 只清理 SonicAI 内部历史记录,不会删除 Navidrome 中已创建的歌单。',
  },
  webhook_history_keep_days: {
    label: 'Webhook 记录保留天数',
    type: 'number',
    tooltip:
      '▸ Webhook 发送记录保留多少天。\n' +
      ' 建议成功记录保留 30 天,失败记录可选择保留用于排查问题。',
  },
  keep_failed_history: {
    label: '保留失败记录',
    type: 'boolean',
    tooltip:
      '▸ 开启后,自动清理只删除成功记录。\n' +
      ' 失败、停止、部分成功记录会保留,方便排查问题。',
  },
  max_concurrent_tasks: {
    label: '全局后台任务最大并发数',
    type: 'number',
    tooltip:
      '▸ 限制通过 SonicAI 后台任务注册器执行的任务数量\n' +
      ' 当前主要影响手动任务和部分后台任务\n' +
      ' Cron 任务后续会逐步统一接入任务调度器\n' +
      ' 默认：2  推荐：1 - 3',
  },
  webhook_timeout_seconds: {
    label: 'Webhook 超时时间',
    type: 'number',
    tooltip: '▸ 缺失通知 Webhook 的超时秒数',
  },
  webhook_retry_count: {
    label: 'Webhook 重试次数',
    type: 'number',
    tooltip: '▸ Webhook 失败后自动重试的次数',
  },
  playlist_api_url: {
    label: 'Playlist API 地址',
    type: 'text',
    tooltip:
      '▸ 第三方歌单解析服务的地址\n' +
      ' 配置后可导入网易云、QQ 音乐等平台歌单',
  },
  recommendation_cron_run_type: {
    label: '定时推荐类型',
    type: 'select',
    tooltip:
      '▸ 控制定时任务执行哪一种 Last.fm 推荐\n' +
      ' · 完整推荐 — 同时生成相似曲目和相邻艺术家歌单\n' +
      ' · 仅相似曲目 — 只生成相似曲目歌单\n' +
      ' · 仅相邻艺术家 — 只生成相邻艺术家歌单',
  },
  playlist_cleanup_enabled: {
    label: '启用歌单自动清理',
    type: 'boolean',
    tooltip:
      '▸ 开启后，系统会按 Cron 定期清理过期歌单\n' +
      ' 默认关闭，避免升级后误删 Navidrome 歌单。',
  },
  playlist_cleanup_cron: {
    label: '歌单清理 Cron',
    type: 'text',
    tooltip:
      '▸ 歌单自动清理的 Cron 表达式\n' +
      ' 默认：30 3 * * *，表示每天凌晨 3:30 执行。',
  },
  playlist_cleanup_delete_navidrome: {
    label: '同时删除 Navidrome 歌单',
    type: 'boolean',
    tooltip:
      '▸ 开启后，清理时会调用 Navidrome 删除远端歌单\n' +
      ' 关闭时仅清空 SonicAI 记录中的 Navidrome 歌单 ID。',
  },
  playlist_cleanup_keep_failed: {
    label: '保留失败任务歌单',
    type: 'boolean',
    tooltip:
      '▸ 开启后，失败、停止或部分成功任务关联的歌单不会被自动清理\n' +
      ' 建议开启，方便排查问题。',
  },
  playlist_cleanup_keep_recent_success_count: {
    label: '每类保留最近成功歌单数',
    type: 'number',
    tooltip:
      '▸ 每种歌单类型至少保留最近 N 个成功歌单\n' +
      ' 可避免某类歌单被按时间全部清空。',
  },
}

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  if (!text) return null

  const lines = text.split('\n')

  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 text-[10px] font-bold flex items-center justify-center transition-colors dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        ?
      </button>

      {open && (
        <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[calc(100vw-2rem)] bg-card text-card-foreground text-xs rounded-xl p-3 shadow-xl border border-border pointer-events-auto">
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
          {lines.map((line, i) => (
            <p key={i} className="leading-relaxed">
              {line || <br />}
            </p>
          ))}
        </div>
      )}
    </span>
  )
}

export function FieldInput({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  const meta = FIELD_LABELS[fieldKey]
  if (!meta) return null

  if (meta.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {meta.label}
            <Tooltip text={meta.tooltip || ''} />
          </label>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-cyan-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>
    )
  }

  if (meta.type === 'select') {
    const options: Record<string, string[]> = {
      library_mode_default: ['library_only', 'allow_missing'],
      seed_source_mode: ['recent_only', 'top_only', 'recent_plus_top'],
      top_period: ['7day', '1month', '3month', '6month', '12month', 'overall'],
      match_mode: ['full', 'local', 'api'],
      missed_track_retry_mode: ['local', 'api', 'full'],
      recommendation_cron_run_type: ['full', 'similar_tracks', 'similar_artists'],
    }

    const labelMaps: Record<string, Record<string, string>> = {
      library_mode_default: LIBRARY_MODE_LABELS,
      seed_source_mode: SEED_SOURCE_MODE_LABELS,
      top_period: TOP_PERIOD_LABELS,
      match_mode: MATCH_MODE_LABELS,
      missed_track_retry_mode: MISSED_RETRY_MODE_LABELS,
      recommendation_cron_run_type: RECOMMENDATION_CRON_RUN_TYPE_LABELS,
    }

    const opts = options[fieldKey] || []
    const labels = labelMaps[fieldKey] || {}

    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          {meta.label}
          <Tooltip text={meta.tooltip || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="select"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>
              {labelOf(labels, opt)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    const raw = Number(value ?? 0)
    const isFloatField = ['match_threshold'].includes(fieldKey)
    const percentValue = isFloatField && raw <= 1 ? Math.round(raw * 100) : raw

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>保守</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {meta.label}：{isFloatField ? `${percentValue}%` : percentValue}
          </span>
          <span>探索</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={percentValue}
          onChange={e => {
            const next = Number(e.target.value)
            onChange(isFloatField ? next / 100 : next)
          }}
          className="w-full accent-cyan-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        {meta.label}
        <Tooltip text={meta.tooltip || ''} />
      </label>

      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => {
          onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)
        }}
        className="input"
      />
    </div>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card card-padding space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="section-title">{title}</h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>

      {children}
    </section>
  )
}

export function useSettingsForm() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const [form, setForm] = useState<Partial<Settings>>({})

  useEffect(() => {
    setForm({})
  }, [data])

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      setForm({})
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('配置已保存', '设置已成功更新')
    },
    onError: (error: Error) => {
      toast.error('保存失败', error.message)
    },
  })

  const s: Settings = {
    ...(data || {}),
    ...form,
  } as Settings

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const hasChanges = Object.keys(form).length > 0

  const save = () => {
    mutation.mutate(form)
  }

  return {
    data,
    s,
    form,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  }
}

export function SaveBar({
  hasChanges,
  isPending,
  isSuccess,
  isError,
  onSave,
}: {
  hasChanges: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  onSave: () => void
}) {
  return (
    <div className="save-bar">
      <div className="card card-padding flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {hasChanges ? '有未保存的更改' : '设置已是最新'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            修改会暂存在当前页面，点击保存后生效。
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={!hasChanges || isPending}
          className="btn-primary w-full sm:w-auto"
        >
          {isPending ? '保存中...' : hasChanges ? '保存更改' : '无需保存'}
        </button>
      </div>

      {isSuccess && (
        <p className="mt-2 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          已保存
        </p>
      )}

      {isError && <p className="mt-2 text-red-500 text-sm">保存失败</p>}
    </div>
  )
}
