import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import apiFetch from '@/lib/api'

export async function fetchSettings() {
  return apiFetch('/settings')
}

export async function updateSettings(data: Record<string, unknown>) {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
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
  search_concurrency: {
    label: '搜索并发数',
    type: 'number',
    tooltip:
      '▸ 同时向 Navidrome 发起的搜索请求数\n' +
      ' 默认：5  推荐：3 - 10',
  },
  playlist_keep_days: {
    label: '歌单保留天数',
    type: 'number',
    tooltip:
      '▸ 推荐歌单在 Navidrome 中保留多少天\n' +
      ' 0 = 永不过期（慎用）',
  },
  max_concurrent_tasks: {
    label: '任务并发数',
    type: 'number',
    tooltip:
      '▸ 同时允许的后台任务数量\n' +
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
}

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  if (!text) return null

  const lines = text.split('\n')

  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-bold flex items-center justify-center transition-colors dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        ?
      </button>

      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-card text-card-foreground text-xs rounded-xl p-3 shadow-xl border border-border pointer-events-auto">
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

  if (meta.type === 'select') {
    const options: Record<string, string[]> = {
      library_mode_default: ['library_only', 'allow_missing'],
      seed_source_mode: ['recent_only', 'top_only', 'recent_plus_top'],
      top_period: ['7day', '1month', '3month', '6month', '12month', 'overall'],
    }

    const opts = options[fieldKey] || []

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
              {opt}
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
          className="w-full accent-orange-500"
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
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card card-padding space-y-4">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  )
}

export function useSettingsForm() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const [form, setForm] = useState<Record<string, unknown>>({})

  useEffect(() => {
    setForm({})
  }, [data])

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      setForm({})
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const s = {
    ...(data || {}),
    ...form,
  }

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
    <div className="sticky bottom-4 z-20">
      <div className="card card-padding flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {hasChanges ? '有未保存的更改' : '当前页面暂无更改'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            此保存按钮只会提交当前页面产生的修改。
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={!hasChanges || isPending}
          className="btn-primary w-full sm:w-auto"
        >
          {isPending ? '保存中...' : '保存配置'}
        </button>
      </div>

      {isSuccess && (
        <p className="mt-2 text-green-600 text-sm">
          <CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />
          已保存
        </p>
      )}

      {isError && <p className="mt-2 text-red-500 text-sm">保存失败</p>}
    </div>
  )
}
