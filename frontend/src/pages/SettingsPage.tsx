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

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const field = (key: string, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={String(s[key] ?? '')}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )

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
        {field('lastfm_api_key', 'API Key')}
        {field('lastfm_username', '用户名')}
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
        {field('navidrome_url', '地址 (含 http/https)')}
        {field('navidrome_username', '用户名')}
        {field('navidrome_password', '密码', 'password')}
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
        {field('webhook_url', 'Webhook URL')}
        {field('webhook_headers_json', 'Headers (JSON)')}
        {field('webhook_retry_count', '重试次数', 'number')}
      </section>

      {/* Recommendation */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">推荐参数</h2>
        <div className="grid grid-cols-2 gap-3">
          {field('top_track_seed_limit', '种子曲目数', 'number')}
          {field('top_artist_seed_limit', '种子艺术家数', 'number')}
          {field('similar_track_limit', '每曲相似曲目数', 'number')}
          {field('similar_artist_limit', '每艺术家相似艺术家数', 'number')}
          {field('artist_top_track_limit', '每相似艺术家热门歌曲', 'number')}
          {field('similar_playlist_size', '相似曲目歌单数量', 'number')}
          {field('artist_playlist_size', '相邻艺术家歌单数量', 'number')}
          {field('duplicate_avoid_days', '去重天数', 'number')}
        </div>
        {/* 推荐平衡滑杆 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">更稳</span>
            <span className="font-medium text-slate-700">推荐平衡：{form.recommendation_balance ?? 50}</span>
            <span className="text-slate-500">更探索</span>
          </div>
          <input
            type="range" min="0" max="100"
            value={form.recommendation_balance ?? 50}
            onChange={e => setForm({ ...form, recommendation_balance: Number(e.target.value) })}
            className="w-full accent-orange-500"
          />
        </div>
      </section>

      {/* Scheduler */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">调度</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => setForm({ ...form, cron_enabled: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">启用定时执行</span>
        </label>
        {field('cron_expression', 'Cron 表达式 (分 时 日 月 周)')}
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
