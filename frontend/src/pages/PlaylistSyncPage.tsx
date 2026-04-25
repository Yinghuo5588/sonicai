import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface SyncResult {
  message: string
  run_id: number
  url: string
  threshold: number
  playlist_name: string
  overwrite: boolean
}

async function triggerSync(url: string, threshold: number, playlistName: string, overwrite: boolean): Promise<SyncResult> {
  const token = localStorage.getItem('sonicai_access_token')
  const params = new URLSearchParams({
    url,
    match_threshold: String(threshold / 100),
    overwrite: String(overwrite),
  })
  if (playlistName.trim()) params.set('playlist_name', playlistName.trim())
  const res = await fetch(`/api/playlist/sync?${params}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any)?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

const PLATFORMS = [
  { label: '网易云音乐', hint: 'music.163.com/playlist?id=xxx' },
  { label: 'QQ音乐', hint: 'y.qq.com/n/ryqq/playlist/xxx' },
  { label: '汽水/抖音', hint: 'qishui.douyin.com/s/xxx' },
]

export default function PlaylistSyncPage() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [threshold, setThreshold] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [localMsg, setLocalMsg] = useState('')

  const mutation = useMutation({
    mutationFn: () => triggerSync(url, threshold, playlistName, overwrite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      setLocalMsg('done')
    },
  })

  const isValid = () =>
    url.includes('163') || url.includes('qq.') || url.includes('qishui') || url.includes('douyin')

  const handleSubmit = () => {
    if (!isValid()) {
      alert('请输入有效的歌单链接')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">🔗 第三方歌单同步</h1>

      <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-4">
        <p className="text-sm text-slate-500">输入网易云/QQ/汽水音乐的歌单链接，自动解析并同步到 Navidrome</p>

        <div>
          <label className="block text-xs text-slate-500 mb-1">歌单链接</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://music.163.com/playlist?id=xxx"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <span key={p.label} className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded">{p.label}</span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">匹配阈值 ({threshold}%)</label>
            <input
              type="range"
              min={50}
              max={95}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">歌单名称（留空自动）</label>
            <input
              type="text"
              value={playlistName}
              onChange={e => setPlaylistName(e.target.value)}
              placeholder="自动从歌单名"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={e => setOverwrite(e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          覆盖同名歌单
        </label>

        <button
          onClick={handleSubmit}
          disabled={!isValid() || mutation.isPending}
          className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {!isValid() ? '请输入歌单链接' : mutation.isPending ? '解析中...' : mutation.isSuccess ? '✅ 已提交' : mutation.isError ? '❌ 失败，重试' : '🎵 解析并同步到 Navidrome'}
        </button>

        {localMsg === 'done' && (
          <div className="bg-green-50 rounded-lg p-3 text-green-600 text-sm">
            ✅ 任务已提交！可在推荐历史查看同步进度
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <p className="text-sm font-medium text-slate-700 mb-2">支持的平台</p>
        {PLATFORMS.map(p => (
          <div key={p.label} className="text-xs text-slate-400 mb-1">• {p.label}: {p.hint}</div>
        ))}
      </div>
    </div>
  )
}
