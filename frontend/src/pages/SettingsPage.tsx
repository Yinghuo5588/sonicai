import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'

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

      {/* Playlist Parsing */}
      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700 text-sm">歌单解析</h2>
        <div className="grid grid-cols-1 gap-3">
          {PLAYLIST_FIELDS.map(key => (
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
