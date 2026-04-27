import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}, "playlist_api_url"]import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: Record<string, unknown>) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

async function testNavidrome() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-navidrome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

async function testWebhook() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings/test-webhook', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Connection failed')
  return data
}

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  // Advanced
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'number', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '歌单解析接口地址，如 https://sss.unmeta.cn/songlist' },
}

const BASIC_FIELDS = [
  'top_track_seed_limit', 'top_artist_seed_limit', 'similar_track_limit',
  'similar_artist_limit', 'artist_top_track_limit', 'similar_playlist_size',
  'artist_playlist_size', 'duplicate_avoid_days', 'recommendation_balance',
  'library_mode_default',
]

const ADVANCED_FIELDS = [
  'seed_source_mode', 'recent_tracks_limit', 'top_period', 'recent_top_mix_ratio',
  'match_threshold', 'webhook_retry_count', 'webhook_timeout_seconds', 'playlist_keep_days',
]

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return (
    <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
  )
}

function FieldInput({ fieldKey, value, onChange }: { fieldKey: string; value: unknown; onChange: (v: unknown) => void }) {
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {meta.label}<Tooltip text={meta.help || ''} />
        </label>
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {opts.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}
          </span>
          <span className="font-medium text-slate-700">
            {meta.label}：{value ?? (fieldKey === 'recommendation_balance' ? 55 : 70)}
          </span>
          <span className="text-slate-500">
            {fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}
          </span>
        </div>
        <input
          type="range" min="0" max="100"
          value={Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {meta.label}<Tooltip text={meta.help || ''} />
      </label>
      <input
        type={meta.type || 'text'}
        value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Last.fm */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">Last.fm</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key<Tooltip text="Last.fm API Key" /></label>
            <input type="text" value={String(s.lastfm_api_key ?? '')} onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Last.fm 用户名" /></label>
            <input type="text" value={String(s.lastfm_username ?? '')} onChange={e => handleChange('lastfm_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Navidrome */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Navidrome</h2>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {navidromeResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {navidromeResult.ok ? '✅ ' : '❌ '}{navidromeResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地址 (含 http/https)<Tooltip text="Navidrome 服务器地址" /></label>
            <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名<Tooltip text="Navidrome 用户名" /></label>
            <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码<Tooltip text="Navidrome 密码" /></label>
            <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Webhook */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700 text-sm">Webhook</h2>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>
        {webhookResult && (
          <p className={`text-xs px-3 py-2 rounded-lg ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {webhookResult.ok ? '✅ ' : '❌ '}{webhookResult.msg}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL<Tooltip text="接收缺失曲目通知的 URL" /></label>
            <input type="text" value={String(s.webhook_url ?? '')} onChange={e => handleChange('webhook_url', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)<Tooltip text="Webhook 请求头，JSON 格式" /></label>
            <input type="text" value={String(s.webhook_headers_json ?? '')} onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </div>
      </section>

      {/* Recommendation - Basic */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map(key => (
            <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
          ))}
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <details open={advancedOpen}>
          <summary
            className="font-medium text-slate-700 text-sm cursor-pointer list-none flex items-center justify-between"
            onClick={e => { e.preventDefault(); setAdvancedOpen(o => !o); }}
          >
            高级设置 {advancedOpen ? '▼' : '▶'}
          </summary>
          {advancedOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ADVANCED_FIELDS.map(key => (
                <FieldInput key={key} fieldKey={key} value={s[key]} onChange={v => handleChange(key, v)} />
              ))}
            </div>
          )}
        </details>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式 (分 时 日 月 周)<Tooltip text="定时任务调度表达式" /></label>
          <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm">✅ 已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}
