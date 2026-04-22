import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: any) {
  const token = localStorage.getItem('sonicai_access_token')
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update')
  return res.json()
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const mutation = useMutation({ mutationFn: updateSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }) })

  const [form, setForm] = useState<any>({})

  if (isLoading) return <div className="p-6 text-slate-500">加载中...</div>

  const s = { ...data, ...form }

  const field = (key: string, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={s[key] ?? ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">系统配置</h1>

      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700">Last.fm</h2>
        {field('lastfm_api_key', 'API Key')}
        {field('lastfm_username', '用户名')}
      </section>

      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700">Navidrome</h2>
        {field('navidrome_url', '地址 (含 http/https)')}
        {field('navidrome_username', '用户名')}
        {field('navidrome_password', '密码', 'password')}
      </section>

      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700">Webhook</h2>
        {field('webhook_url', 'Webhook URL')}
        {field('webhook_headers_json', 'Headers (JSON)')}
        {field('webhook_retry_count', '重试次数', 'number')}
      </section>

      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700">推荐参数</h2>
        <div className="grid grid-cols-2 gap-4">
          {field('similar_playlist_size', '相似曲目歌单数量', 'number')}
          {field('artist_playlist_size', '相邻艺术家歌单数量', 'number')}
          {field('duplicate_avoid_days', '去重天数', 'number')}
          {field('recommendation_balance', '推荐平衡 (0-100)', 'number')}
        </div>
      </section>

      <section className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <h2 className="font-medium text-slate-700">调度</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.cron_enabled ?? false}
              onChange={e => setForm({ ...form, cron_enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">启用定时执行</span>
          </label>
        </div>
        {field('cron_expression', 'Cron 表达式 (分 时 日 月 周)')}
      </section>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? '保存中...' : '保存配置'}
      </button>
      {mutation.isError && <p className="text-red-500">保存失败</p>}
      {mutation.isSuccess && <p className="text-green-600">已保存</p>}
    </div>
  )
}