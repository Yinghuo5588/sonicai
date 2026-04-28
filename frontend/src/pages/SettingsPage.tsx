import { useState } from 'react'
import apiFetch from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { changePasswordSchema } from '@/lib/validators'
import RecommendPreview from '@/components/RecommendPreview'

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

// ── Field metadata ───────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, { label: string; type?: string; tooltip: string }> = {
  library_mode_default: {
    label: '推荐模式',
    type: 'select',
    tooltip: '▸ 控制缺失歌曲的处理方式\n' +
      ' 默认：library_only  可选：allow_missing\n' +
      ' · library_only — 只保留库内能匹配的歌曲\n' +
      ' · allow_missing — 无法匹配的通过 Webhook 通知',
  },
  recommendation_balance: {
    label: '推荐平衡',
    type: 'slider',
    tooltip: '▸ 探索新歌 vs 保守听熟曲的程度\n' +
      ' 默认：55  推荐：40 - 70\n' +
      ' 0 → 极致保守（命中率最高）\n' +
      ' 100 → 极致探索（缺失可能增加）',
  },
  top_track_seed_limit: {
    label: '种子曲目数',
    type: 'number',
    tooltip: '▸ 从 Last.fm 热门中取多少首作为种子\n' +
      ' 默认：30  推荐：15 - 50\n' +
      ' 数量越多歌单越多样，但执行更慢',
  },
  top_artist_seed_limit: {
    label: '种子艺术家数',
    type: 'number',
    tooltip: '▸ 相邻艺术家歌单的种子艺人数量\n' +
      ' 默认：30  推荐：10 - 40\n' +
      ' 越多越多样，API 调用也更多',
  },
  similar_track_limit: {
    label: '每曲相似曲目数',
    type: 'number',
    tooltip: '▸ 每个种子从 Last.fm 获取多少相似歌曲\n' +
      ' 默认：30  推荐：20 - 50\n' +
      ' 数值越大候选池越大，但相关性可能下降',
  },
  similar_artist_limit: {
    label: '每种子取相似艺术家数',
    type: 'number',
    tooltip: '▸ 每个种子艺人获取多少位相似艺人\n' +
      ' 默认：30  推荐：10 - 30\n' +
      ' 影响相邻艺术家歌单的多样性',
  },
  artist_top_track_limit: {
    label: '每相似艺术家热门歌曲',
    type: 'number',
    tooltip: '▸ 每个相似艺人取多少首热门歌\n' +
      ' 默认：2  推荐：1 - 5\n' +
      ' 值小 → 更精准；值大 → 更丰富但可能跑偏',
  },
  similar_playlist_size: {
    label: '相似曲目歌单大小',
    type: 'number',
    tooltip: '▸ 最终相似曲目歌单的最大歌曲数\n' +
      ' 默认：30  推荐：30 - 100\n' +
      ' 实际命中数受你的 Navidrome 库存影响',
  },
  artist_playlist_size: {
    label: '相邻艺术家歌单大小',
    type: 'number',
    tooltip: '▸ 最终相邻艺术家歌单的最大歌曲数\n' +
      ' 默认：30  推荐：30 - 100',
  },
  duplicate_avoid_days: {
    label: '去重天数',
    type: 'number',
    tooltip: '▸ 同一首歌多少天内不会再次推荐\n' +
      ' 默认：14  推荐：7 - 30\n' +
      ' 0 = 不去重，可能连续出现重复',
  },
  seed_source_mode: {
    label: '种子来源模式',
    type: 'select',
    tooltip: '▸ 从哪里选取推荐种子\n' +
      ' 默认：recent_plus_top（建议保持）\n' +
      ' · recent_only — 仅最近播放\n' +
      ' · top_only — 仅历史排行\n' +
      ' · recent_plus_top — 两者混合',
  },
  top_period: {
    label: 'Top 数据周期',
    type: 'select',
    tooltip: '▸ Last.fm 历史排行榜的统计周期\n' +
      ' 默认：1month  推荐：1month - 3month\n' +
      ' 周期越长口味越稳定，短期变化不敏感',
  },
  recent_tracks_limit: {
    label: 'Recent Tracks 抓取条数',
    type: 'number',
    tooltip: '▸ 抓取最近播放记录的数量（仅影响统计窗口）\n' +
      ' 默认：100  推荐：100 - 500',
  },
  recent_top_mix_ratio: {
    label: 'Recent/Top 混合比例',
    type: 'slider',
    tooltip: '▸ 种子中「最近播放」的占比\n' +
      ' 默认：70  推荐：50 - 80\n' +
      ' 70 → 70% 来自最近播放，30% 来自历史排行',
  },
  match_threshold: {
    label: '匹配阈值',
    type: 'slider',
    tooltip: '▸ 匹配 Navidrome 歌曲的最低相似度\n' +
      ' 默认：0.75  推荐：0.70 - 0.85\n' +
      ' 太低 → 可能匹配错误；太高 → 命中减少',
  },
  search_concurrency: {
    label: '搜索并发数',
    type: 'number',
    tooltip: '▸ 同时向 Navidrome 发起的搜索请求数\n' +
      ' 默认：5  推荐：3 - 10\n' +
      ' 太高可能被 Navidrome 限流，注意服务器负载',
  },
  playlist_keep_days: {
    label: '歌单保留天数',
    type: 'number',
    tooltip: '▸ 推荐歌单在 Navidrome 中保留多少天\n' +
      ' 默认：3  推荐：3 - 30\n' +
      ' 超期后自动删除，0 = 永不过期（慎用）',
  },
  max_concurrent_tasks: {
    label: '任务并发数',
    type: 'number',
    tooltip: '▸ 同时允许的后台任务数量\n' +
      ' 默认：2  推荐：1 - 3\n' +
      ' 过高可能造成 API 压力',
  },
  webhook_timeout_seconds: {
    label: 'Webhook 超时时间',
    type: 'number',
    tooltip: '▸ 缺失通知 Webhook 的超时秒数\n' +
      ' 默认：10  推荐：5 - 30',
  },
  webhook_retry_count: {
    label: 'Webhook 重试次数',
    type: 'number',
    tooltip: '▸ Webhook 失败后自动重试的次数\n' +
      ' 默认：3  推荐：1 - 5\n' +
      ' 间隔逐渐延长（1分钟/5分钟/15分钟）',
  },
  playlist_api_url: {
    label: 'Playlist API 地址',
    type: 'text',
    tooltip: '▸ 第三方歌单解析服务的地址\n' +
      ' 推荐：https://sss.unmeta.cn/songlist\n' +
      ' 配置后可导入网易云、QQ 音乐等平台歌单',
  },
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const lines = text.split('\n')
  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 text-[10px] font-bold flex items-center justify-center transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title={text}
      >?</button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white text-slate-700 text-xs rounded-lg p-3 shadow-lg border border-slate-200 pointer-events-auto">
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-white" />
          {lines.map((line, i) => (<p key={i} className="leading-relaxed">{line || <br />}</p>))}
        </div>
      )}
    </span>
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
        <label className="block text-sm font-medium text-slate-700 mb-1">{meta.label}<Tooltip text={meta.tooltip || ''} /></label>
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          {opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }
  if (meta.type === 'slider') {
    const numVal = Number(value ?? 55)
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>保守</span>
          <span className="font-medium text-slate-700">{meta.label}：{numVal}</span>
          <span>探索</span>
        </div>
        <input type="range" min="0" max="100" value={numVal}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-orange-500" />
      </div>
    )
  }
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{meta.label}<Tooltip text={meta.tooltip || ''} /></label>
      <input type={meta.type || 'text'} value={String(value ?? '')}
        onChange={e => onChange(meta.type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
    </div>
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

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-lg">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <span className="text-slate-400 text-xs">{open ? '收起' : '展开'}</span>
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
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
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>
  const s = { ...data, ...form }
  const handleChange = (key: string, value: unknown) => { setForm(prev => ({ ...prev, [key]: value })) }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)
    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) { setNavidromeResult({ ok: false, msg: err.message }) }
    finally { setNavidromeLoading(false) }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)
    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
    } catch (err: any) { setWebhookResult({ ok: false, msg: err.message }) }
    finally { setWebhookLoading(false) }
  }

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
        body: JSON.stringify({ old_password: validation.data.oldPassword, new_password: validation.data.newPassword }),
      })
      setPasswordResult({ ok: true, msg: '密码修改成功' })
      setOldPassword('')
      setNewPassword('')
    } catch (err: any) { setPasswordResult({ ok: false, msg: err.message }) }
    finally { setPasswordLoading(false) }
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
    } catch (err: any) { alert('导出失败: ' + (err.message || '未知错误')) }
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
    } catch (err: any) { setImportResult({ ok: false, msg: '导入失败: ' + (err.message || '未知错误') }) }
    finally { e.target.value = '' }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">系统配置</h1>

      <CollapsibleSection title="服务连接" defaultOpen={true}>
        <div className="space-y-4">
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

          <SectionCard title="歌单解析">
            <FieldInput fieldKey="playlist_api_url" value={s.playlist_api_url} onChange={v => handleChange('playlist_api_url', v)} />
          </SectionCard>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="推荐源 (Last.fm 抓取策略)" defaultOpen={false}>
        <div className="space-y-4">
          <SectionCard title="种子抓取策略">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput fieldKey="seed_source_mode" value={s.seed_source_mode} onChange={v => handleChange('seed_source_mode', v)} />
              {(s.seed_source_mode === 'recent_only' || s.seed_source_mode === 'recent_plus_top') && (
                <FieldInput fieldKey="recent_tracks_limit" value={s.recent_tracks_limit} onChange={v => handleChange('recent_tracks_limit', v)} />
              )}
              {(s.seed_source_mode === 'top_only' || s.seed_source_mode === 'recent_plus_top') && (
                <FieldInput fieldKey="top_period" value={s.top_period} onChange={v => handleChange('top_period', v)} />
              )}
              {s.seed_source_mode === 'recent_plus_top' && (
                <FieldInput fieldKey="recent_top_mix_ratio" value={s.recent_top_mix_ratio} onChange={v => handleChange('recent_top_mix_ratio', v)} />
              )}
            </div>
          </SectionCard>
          <SectionCard title="获取数量控制">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput fieldKey="top_track_seed_limit" value={s.top_track_seed_limit} onChange={v => handleChange('top_track_seed_limit', v)} />
              <FieldInput fieldKey="top_artist_seed_limit" value={s.top_artist_seed_limit} onChange={v => handleChange('top_artist_seed_limit', v)} />
              <FieldInput fieldKey="similar_track_limit" value={s.similar_track_limit} onChange={v => handleChange('similar_track_limit', v)} />
              <FieldInput fieldKey="similar_artist_limit" value={s.similar_artist_limit} onChange={v => handleChange('similar_artist_limit', v)} />
              <FieldInput fieldKey="artist_top_track_limit" value={s.artist_top_track_limit} onChange={v => handleChange('artist_top_track_limit', v)} />
            </div>
          </SectionCard>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="歌单匹配 (Navidrome 生成与匹配)" defaultOpen={false}>
        <div className="space-y-4">
          <SectionCard title="歌单规模">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput fieldKey="similar_playlist_size" value={s.similar_playlist_size} onChange={v => handleChange('similar_playlist_size', v)} />
              <FieldInput fieldKey="artist_playlist_size" value={s.artist_playlist_size} onChange={v => handleChange('artist_playlist_size', v)} />
            </div>
          </SectionCard>
          <SectionCard title="推荐平衡与预览">
            <FieldInput fieldKey="recommendation_balance" value={s.recommendation_balance} onChange={v => handleChange('recommendation_balance', v)} />
            <RecommendPreview
              seedCount={Number(s.top_track_seed_limit) || 30}
              similarPerSeed={Number(s.similar_track_limit) || 30}
              playlistSize={Number(s.similar_playlist_size) || 30}
              balance={Number(s.recommendation_balance) || 55}
              threshold={Number(s.match_threshold) || 0.75}
            />
          </SectionCard>
          <SectionCard title="匹配与搜索">
            <div className="space-y-3">
              <FieldInput fieldKey="match_threshold" value={s.match_threshold} onChange={v => handleChange('match_threshold', v)} />
              <FieldInput fieldKey="search_concurrency" value={s.search_concurrency} onChange={v => handleChange('search_concurrency', v)} />
              <FieldInput fieldKey="duplicate_avoid_days" value={s.duplicate_avoid_days} onChange={v => handleChange('duplicate_avoid_days', v)} />
              <FieldInput fieldKey="library_mode_default" value={s.library_mode_default} onChange={v => handleChange('library_mode_default', v)} />
            </div>
          </SectionCard>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="调度设置" defaultOpen={false}>
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
      </CollapsibleSection>

      <CollapsibleSection title="账户与备份" defaultOpen={false}>
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
                导出配置
              </button>
              <label className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 cursor-pointer transition-colors">
                导入配置
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
      </CollapsibleSection>

      <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium">
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isSuccess && <p className="text-green-600 text-sm"><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />已保存</p>}
      {mutation.isError && <p className="text-red-500 text-sm">保存失败</p>}
    </div>
  )
}