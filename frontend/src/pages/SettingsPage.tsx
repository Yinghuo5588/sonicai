import { useState } from 'react'
import apiFetch from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { changePasswordSchema } from '@/lib/validators'

async function fetchSettings() {
  return apiFetch('/settings')
}

async function updateSettings(data: Record<string, unknown>) {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

async function testNavidrome() {
  return apiFetch('/settings/test-navidrome', { method: 'POST' })
}

async function testWebhook() {
  return apiFetch('/settings/test-webhook', { method: 'POST' })
}

const TABS = ['服务连接', '推荐参数', '调度设置', '账户与备份'] as const
type Tab = typeof TABS[number]

// ── Field metadata ───────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, { label: string; type?: string; help?: string }> = {
  // Recommendation params
  library_mode_default: { label: '推荐模式', type: 'select', help: 'library_only=仅推荐库内曲目，allow_missing=允许缺失发Webhook' },
  top_track_seed_limit: { label: '种子曲目数', type: 'number', help: '相似曲目歌单从多少首种子歌出发' },
  top_artist_seed_limit: { label: '种子艺术家数', type: 'number', help: '相邻艺术家歌单从多少个种子艺人出发' },
  similar_track_limit: { label: '每曲相似曲目数', type: 'number', help: '每首种子歌曲获取多少首相似曲目' },
  similar_artist_limit: { label: '每种子取相似艺术家数', type: 'number', help: '每个种子艺人获取多少个相似艺人' },
  artist_top_track_limit: { label: '每相似艺术家热门歌曲', type: 'number', help: '每个相似艺人取多少首热门歌曲' },
  similar_playlist_size: { label: '相似曲目歌单大小', type: 'number', help: '相似曲目歌单最终保留多少首歌' },
  artist_playlist_size: { label: '相邻艺术家歌单大小', type: 'number', help: '相邻艺术家歌单最终保留多少首歌' },
  duplicate_avoid_days: { label: '去重天数', type: 'number', help: '最近多少天推荐过的歌不再重复推荐，0=关闭' },
  recommendation_balance: { label: '推荐平衡', type: 'slider', help: '0=更保守，100=更探索' },
  seed_source_mode: { label: '种子来源模式', type: 'select', help: 'recent_only=只用最近播放，top_only=只用历史排行，recent_plus_top=混合' },
  recent_tracks_limit: { label: 'Recent Tracks 抓取条数', type: 'number', help: 'recent种子统计窗口大小' },
  top_period: { label: 'Top 数据周期', type: 'select', help: 'user.getTopTracks 的 period 参数' },
  recent_top_mix_ratio: { label: 'Recent/Top 混合比例', type: 'slider', help: '种子中 recent 的占比，70=70% recent 30% top' },
  match_threshold: { label: '匹配阈值', type: 'slider', help: 'Navidrome 搜索结果接受的最小分数，0.5-0.95' },
  candidate_pool_multiplier_min: { label: '候选池最小倍数', type: 'number', help: '候选池 = 推荐数量 × 倍数' },
  candidate_pool_multiplier_max: { label: '候选池最大倍数', type: 'number', help: '候选池上限，平衡质量与覆盖' },
  search_concurrency: { label: '搜索并发数', type: 'number', help: 'Navidrome 并发搜索数，1-20，默认5' },
  // Scheduler
  playlist_keep_days: { label: '歌单保留天数', type: 'number', help: '推荐歌单在 Navidrome 中保留几天' },
  max_concurrent_tasks: { label: '任务并发数', type: 'number', help: '全局后台任务最大同时运行数，1-5，默认2' },
  // Connection
  playlist_api_url: { label: 'Playlist API 地址', type: 'text', help: '第三方歌单解析 API。例: https://sss.unmeta.cn/songlist' },
  webhook_retry_count: { label: 'Webhook 重试次数', type: 'number', help: '缺失歌曲 webhook 失败后自动重试次数' },
  webhook_timeout_seconds: { label: 'Webhook 超时时间', type: 'number', help: 'Webhook 请求超时秒数' },
}

// ── Field groups per tab ────────────────────────────────────────────────────────

const RECOMMEND_FIELDS = [
  'library_mode_default',
  'top_track_seed_limit', 'top_artist_seed_limit',
  'similar_track_limit', 'similar_artist_limit',
  'artist_top_track_limit',
  'similar_playlist_size', 'artist_playlist_size',
  'duplicate_avoid_days', 'recommendation_balance',
  'seed_source_mode', 'recent_tracks_limit',
  'top_period', 'recent_top_mix_ratio',
  'match_threshold',
  'candidate_pool_multiplier_min', 'candidate_pool_multiplier_max',
  'search_concurrency',
]

const SCHEDULER_FIELDS = [
  'playlist_keep_days', 'max_concurrent_tasks',
]

// ── UI helpers ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  if (!text) return null
  return <span className="ml-1 text-slate-400 cursor-help text-xs" title={text}>?</span>
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
          {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }

  if (meta.type === 'slider') {
    const numVal = Number(value ?? (fieldKey === 'recommendation_balance' ? 55 : 70))
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{fieldKey === 'recent_top_mix_ratio' ? '更偏Recent' : '更稳'}</span>
          <span className="font-medium text-slate-700">{meta.label}：{numVal}</span>
          <span>{fieldKey === 'recent_top_mix_ratio' ? '更偏Top' : '更探索'}</span>
        </div>
        <input
          type="range" min="0" max="100"
          value={numVal}
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

// ── Tab sections ────────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600 bg-white'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
      <h3 className="font-medium text-slate-700 text-sm">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const [activeTab, setActiveTab] = useState<Tab>('服务连接')
  const [form, setForm] = useState<Record<string, unknown>>({})

  // Connection tab state
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)

  // Account tab state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const handleChange = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ── Test handlers ─────────────────────────────────────────────────────────────

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

  // ── Password & backup handlers ────────────────────────────────────────────────

  const handleChangePassword = async () => {
    setPasswordLoading(true)
    setPasswordResult(null)
    const validation = changePasswordSchema.safeParse({ oldPassword, newPassword })
    if (!validation.success) {
      setPasswordResult({ ok: false, msg: validation.error.errors[0].message })
      setPasswordLoading(false)
      return
    }
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          old_password: validation.data.oldPassword,
          new_password: validation.data.newPassword,
        }),
      })
      setPasswordResult({ ok: true, msg: '密码修改成功' })
      setOldPassword('')
      setNewPassword('')
    } catch (err: any) {
      setPasswordResult({ ok: false, msg: err.message })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const data = await apiFetch('/settings/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sonicai-config-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('导出失败: ' + (err.message || '未知错误'))
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      if (!json.settings || typeof json.settings !== 'object') throw new Error('无效配置文件')
      const result = await apiFetch('/settings/import', {
        method: 'POST',
        body: JSON.stringify({ settings: json.settings }),
      })
      setImportResult({ ok: true, msg: `导入成功，更新了 ${result.updated_fields.length} 个字段` })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err: any) {
      setImportResult({ ok: false, msg: '导入失败: ' + (err.message || '未知错误') })
    } finally {
      e.target.value = ''
    }
  }

  // ── Tab content ───────────────────────────────────────────────────────────────

  const renderTabContent = () => {
    if (activeTab === '服务连接') return (
      <div className="space-y-4">
        {/* Last.fm */}
        <SectionCard title="Last.fm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </SectionCard>

        {/* Navidrome */}
        <SectionCard title="Navidrome">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">测试与 Navidrome 服务器的连通性</span>
            <button onClick={handleTestNavidrome} disabled={navidromeLoading || !s.navidrome_url}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors">
              {navidromeLoading ? '检测中...' : '检测连通性'}
            </button>
          </div>
          {navidromeResult && (
            <p className={`text-xs px-3 py-2 rounded-lg mb-3 ${navidromeResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {navidromeResult.ok
                ? <><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />{navidromeResult.msg}</>
                : <><XCircle className="inline w-4 h-4 text-red-500 mr-1" />{navidromeResult.msg}</>}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">地址<Tooltip text="Navidrome 服务器地址，含 http/https" /></label>
              <input type="text" value={String(s.navidrome_url ?? '')} onChange={e => handleChange('navidrome_url', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input type="text" value={String(s.navidrome_username ?? '')} onChange={e => handleChange('navidrome_username', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
              <input type="password" value={String(s.navidrome_password ?? '')} onChange={e => handleChange('navidrome_password', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
          </div>
        </SectionCard>

        {/* Webhook */}
        <SectionCard title="Webhook">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">测试 Webhook URL 连通性</span>
            <button onClick={handleTestWebhook} disabled={webhookLoading || !s.webhook_url}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50 transition-colors">
              {webhookLoading ? '检测中...' : '检测连通性'}
            </button>
          </div>
          {webhookResult && (
            <p className={`text-xs px-3 py-2 rounded-lg mb-3 ${webhookResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {webhookResult.ok
                ? <><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />{webhookResult.msg}</>
                : <><XCircle className="inline w-4 h-4 text-red-500 mr-1" />{webhookResult.msg}</>}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3">
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
          <div className="grid grid-cols-2 gap-3 mt-3">
            <FieldInput fieldKey="webhook_timeout_seconds" value={s.webhook_timeout_seconds} onChange={v => handleChange('webhook_timeout_seconds', v)} />
            <FieldInput fieldKey="webhook_retry_count" value={s.webhook_retry_count} onChange={v => handleChange('webhook_retry_count', v)} />
          </div>
        </SectionCard>

        {/* Playlist API */}
        <SectionCard title="歌单解析">
          <FieldInput fieldKey="playlist_api_url" value={s.playlist_api_url} onChange={v => handleChange('playlist_api_url', v)} />
        </SectionCard>
      </div>
    )

    if (activeTab === '推荐参数') return (
      <div className="space-y-4">
        <SectionCard title="推荐核心">
          <div className="grid grid-cols-2 gap-3">
            <FieldInput fieldKey="library_mode_default" value={s.library_mode_default} onChange={v => handleChange('library_mode_default', v)} />
            <FieldInput fieldKey="recommendation_balance" value={s.recommendation_balance} onChange={v => handleChange('recommendation_balance', v)} />
            <FieldInput fieldKey="top_track_seed_limit" value={s.top_track_seed_limit} onChange={v => handleChange('top_track_seed_limit', v)} />
            <FieldInput fieldKey="top_artist_seed_limit" value={s.top_artist_seed_limit} onChange={v => handleChange('top_artist_seed_limit', v)} />
            <FieldInput fieldKey="similar_track_limit" value={s.similar_track_limit} onChange={v => handleChange('similar_track_limit', v)} />
            <FieldInput fieldKey="similar_artist_limit" value={s.similar_artist_limit} onChange={v => handleChange('similar_artist_limit', v)} />
            <FieldInput fieldKey="artist_top_track_limit" value={s.artist_top_track_limit} onChange={v => handleChange('artist_top_track_limit', v)} />
            <FieldInput fieldKey="similar_playlist_size" value={s.similar_playlist_size} onChange={v => handleChange('similar_playlist_size', v)} />
            <FieldInput fieldKey="artist_playlist_size" value={s.artist_playlist_size} onChange={v => handleChange('artist_playlist_size', v)} />
            <FieldInput fieldKey="duplicate_avoid_days" value={s.duplicate_avoid_days} onChange={v => handleChange('duplicate_avoid_days', v)} />
          </div>
        </SectionCard>

        <SectionCard title="种子策略">
          <div className="grid grid-cols-2 gap-3">
            <FieldInput fieldKey="seed_source_mode" value={s.seed_source_mode} onChange={v => handleChange('seed_source_mode', v)} />
            <FieldInput fieldKey="top_period" value={s.top_period} onChange={v => handleChange('top_period', v)} />
            <FieldInput fieldKey="recent_tracks_limit" value={s.recent_tracks_limit} onChange={v => handleChange('recent_tracks_limit', v)} />
            <FieldInput fieldKey="recent_top_mix_ratio" value={s.recent_top_mix_ratio} onChange={v => handleChange('recent_top_mix_ratio', v)} />
          </div>
        </SectionCard>

        <SectionCard title="匹配与候选池">
          <div className="space-y-3">
            <FieldInput fieldKey="match_threshold" value={s.match_threshold} onChange={v => handleChange('match_threshold', v)} />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput fieldKey="candidate_pool_multiplier_min" value={s.candidate_pool_multiplier_min} onChange={v => handleChange('candidate_pool_multiplier_min', v)} />
              <FieldInput fieldKey="candidate_pool_multiplier_max" value={s.candidate_pool_multiplier_max} onChange={v => handleChange('candidate_pool_multiplier_max', v)} />
            </div>
            <FieldInput fieldKey="search_concurrency" value={s.search_concurrency} onChange={v => handleChange('search_concurrency', v)} />
          </div>
        </SectionCard>
      </div>
    )

    if (activeTab === '调度设置') return (
      <div className="space-y-4">
        <SectionCard title="推荐定时任务">
          <label className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={!!s.cron_enabled} onChange={e => handleChange('cron_enabled', e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">启用定时推荐</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cron 表达式<Tooltip text="分 时 日 月 周" /></label>
            <input type="text" value={String(s.cron_expression ?? '')} onChange={e => handleChange('cron_expression', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        </SectionCard>

        <SectionCard title="网易云热榜定时同步">
          <p className="text-xs text-slate-400 mb-3">定时从网易云抓取热榜并同步到 Navidrome</p>
          <label className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={!!s.hotboard_cron_enabled} onChange={e => handleChange('hotboard_cron_enabled', e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">启用热榜定时同步</span>
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cron 表达式</label>
              <input type="text" value={String(s.hotboard_cron_expression ?? '')} onChange={e => handleChange('hotboard_cron_expression', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">抓取数量</label>
              <input type="number" min={1} max={200} value={Number(s.hotboard_limit ?? 50)}
                onChange={e => handleChange('hotboard_limit', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">匹配阈值</span>
              <span className="text-xs font-medium">{Math.round((s.hotboard_match_threshold ?? 0.75) * 100)}%</span>
            </div>
            <input type="range" min={50} max={95}
              value={Number((s.hotboard_match_threshold ?? 0.75) * 100)}
              onChange={e => handleChange('hotboard_match_threshold', Number(e.target.value) / 100)}
              className="w-full accent-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="歌单名称（留空自动）" value={String(s.hotboard_playlist_name ?? '')}
              onChange={e => handleChange('hotboard_playlist_name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!s.hotboard_overwrite}
                onChange={e => handleChange('hotboard_overwrite', e.target.checked)} className="w-4 h-4 accent-blue-500" />
              覆盖同名歌单
            </label>
          </div>
        </SectionCard>

        <SectionCard title="歌单链接定时同步">
          <p className="text-xs text-slate-400 mb-3">监控指定歌单链接，变化时自动增量同步到 Navidrome</p>
          <label className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={!!s.playlist_sync_cron_enabled}
              onChange={e => handleChange('playlist_sync_cron_enabled', e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">启用歌单定时同步</span>
          </label>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cron 表达式</label>
              <input type="text" placeholder="0 */6 * * * (每6小时)" value={String(s.playlist_sync_cron_expression ?? '')}
                onChange={e => handleChange('playlist_sync_cron_expression', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">歌单链接</label>
              <input type="text" placeholder="https://music.163.com/playlist?id=xxx" value={String(s.playlist_sync_url ?? '')}
                onChange={e => handleChange('playlist_sync_url', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">匹配阈值</span>
                  <span className="text-xs font-medium">{Math.round((s.playlist_sync_threshold ?? 0.75) * 100)}%</span>
                </div>
                <input type="range" min={50} max={95}
                  value={Number((s.playlist_sync_threshold ?? 0.75) * 100)}
                  onChange={e => handleChange('playlist_sync_threshold', Number(e.target.value) / 100)}
                  className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">歌单名称</label>
                <input type="text" placeholder="留空自动" value={String(s.playlist_sync_name ?? '')}
                  onChange={e => handleChange('playlist_sync_name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!s.playlist_sync_overwrite}
                onChange={e => handleChange('playlist_sync_overwrite', e.target.checked)} className="w-4 h-4 accent-blue-500" />
              每次全量覆盖（默认增量追加新歌）
            </label>
          </div>
        </SectionCard>

        <SectionCard title="任务管理">
          <div className="grid grid-cols-2 gap-3">
            <FieldInput fieldKey="playlist_keep_days" value={s.playlist_keep_days} onChange={v => handleChange('playlist_keep_days', v)} />
            <FieldInput fieldKey="max_concurrent_tasks" value={s.max_concurrent_tasks} onChange={v => handleChange('max_concurrent_tasks', v)} />
          </div>
        </SectionCard>
      </div>
    )

    // 账户与备份
    return (
      <div className="space-y-4">
        <SectionCard title="修改密码">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">旧密码</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">新密码（至少6位）</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <button onClick={handleChangePassword}
              disabled={!oldPassword || newPassword.length < 6 || passwordLoading}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">
              {passwordLoading ? '修改中...' : '修改密码'}
            </button>
            {passwordResult && (
              <p className={`text-sm ${passwordResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {passwordResult.ok
                  ? <><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />密码修改成功</>
                  : <><XCircle className="inline w-4 h-4 text-red-500 mr-1" />{passwordResult.msg}</>}
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="配置备份">
          <p className="text-xs text-slate-400 mb-3">
            导出或导入全部配置（JSON格式）。迁移时请注意备份 .env 中的 JWT_SECRET_KEY，否则密码无法解密。
          </p>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors">
              📥 导出配置
            </button>
            <label className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 cursor-pointer transition-colors">
              📤 导入配置
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          {importResult && (
            <p className={`text-sm ${importResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {importResult.msg}
            </p>
          )}
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <TabButton
            key={tab}
            label={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Tab content */}
      {renderTabContent()}

      {/* Save button — always visible */}
      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && (
        <p className="text-green-600 text-sm"><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />已保存</p>
      )}
      {mutation.isError && (
        <p className="text-red-500 text-sm">保存失败</p>
      )}
    </div>
  )
}
