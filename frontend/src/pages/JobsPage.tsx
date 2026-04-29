import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { Star, Music, FileText, CheckCircle, XCircle } from 'lucide-react'

async function triggerJob(type: string) {
  const endpoint = type === 'full' ? 'all' : type
  return apiFetch(`/jobs/run-${endpoint}`, { method: 'POST' })
}

async function triggerHotboard(limit: number, threshold: number, playlistName: string, overwrite: boolean) {
  const params = new URLSearchParams({ limit: String(limit), match_threshold: String(threshold / 100) })
  if (playlistName.trim()) params.set('playlist_name', playlistName.trim())
  params.set('overwrite', String(overwrite))
  return apiFetch(`/hotboard/sync?${params}`, { method: 'POST' })
}

async function triggerPlaylistSync(url: string, threshold: number, playlistName: string, overwrite: boolean) {
  const params = new URLSearchParams({ url, match_threshold: String(threshold) })
  if (playlistName.trim()) params.set('playlist_name', playlistName.trim())
  params.set('overwrite', String(overwrite))
  return apiFetch(`/playlist/sync?${params}`, { method: 'POST' })
}

export default function JobsPage() {
  const allMutation = useMutation({ mutationFn: () => triggerJob('all') })
  const tracksMutation = useMutation({ mutationFn: () => triggerJob('similar-tracks') })
  const artistsMutation = useMutation({ mutationFn: () => triggerJob('similar-artists') })

  const [limit, setLimit] = useState(50)
  const [threshold, setThreshold] = useState(75)
  const [hotboardName, setHotboardName] = useState('')
  const [hotboardOverwrite, setHotboardOverwrite] = useState(false)
  const hotboardMutation = useMutation({ mutationFn: () => triggerHotboard(limit, threshold, hotboardName, hotboardOverwrite) })

  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistThreshold, setPlaylistThreshold] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistOverwrite, setPlaylistOverwrite] = useState(false)
  const playlistMutation = useMutation({ mutationFn: () => triggerPlaylistSync(playlistUrl, playlistThreshold / 100, playlistName, playlistOverwrite) })

  const [textFile, setTextFile] = useState<File | null>(null)
  const [textThreshold, setTextThreshold] = useState(75)
  const [textPlaylistName, setTextPlaylistName] = useState('')
  const [textOverwrite, setTextOverwrite] = useState(false)
  const textMutation = useMutation({
    mutationFn: async () => {
      if (!textFile) throw new Error('请选择文件')
      const formData = new FormData()
      formData.append('file', textFile)
      const params = new URLSearchParams({ match_threshold: String(textThreshold / 100), overwrite: String(textOverwrite) })
      if (textPlaylistName.trim()) params.set('playlist_name', textPlaylistName.trim())
      const token = localStorage.getItem('sonicai_access_token')
      const res = await fetch(`/api/playlist/sync-text?${params}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).detail || `HTTP ${res.status}`)
      }
      return res.json()
    },
  })

  const run = (mutation: ReturnType<typeof useMutation>, label: string) => (
    <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1 w-full">
      {mutation.isPending ? '执行中...' : mutation.isSuccess ? '✅ 已提交' : mutation.isError ? '失败，重试' : label}
    </button>
  )

  const isPlaylistUrlValid = (v: string) => /https?:\/\//.test(v) && (v.includes('163') || v.includes('qq.com') || v.includes('qishui') || v.includes('douyin.com'))

  return (
    <div className="page">
      <div>
        <h1 className="page-title">任务执行</h1>
        <p className="page-subtitle mt-1">手动触发推荐任务、同步第三方歌单或上传文本歌单。</p>
      </div>

      <div className="card card-padding space-y-4">
        <h2 className="section-title flex items-center gap-2">手动执行推荐</h2>
        <div className="flex flex-col gap-2">
          {run(allMutation, '执行全部')}
          {run(tracksMutation, '仅相似曲目')}
          {run(artistsMutation, '仅相邻艺术家')}
        </div>
      </div>

      <div className="card card-padding space-y-4">
        <h2 className="section-title flex items-center gap-2"><Star className="w-4 h-4" />网易云热榜同步</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">抓取热榜歌曲数</label>
            <input type="number" min={1} max={200} value={limit} onChange={e => setLimit(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">匹配阈值 ({threshold}%)</label>
            <input type="range" min={50} max={95} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg accent-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空则自动生成）</label>
          <input type="text" value={hotboardName} onChange={e => setHotboardName(e.target.value)} placeholder="网易云热榜 - 2026-04-25" className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={hotboardOverwrite} onChange={e => setHotboardOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-500" />
          覆盖同名歌单
        </label>
        {run(hotboardMutation, '🌟 网易云热榜同步')}
        {hotboardMutation.isSuccess && <p className="text-green-600 text-sm"><CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />已提交，可在推荐历史查看进度</p>}
        {hotboardMutation.isError && <p className="text-red-500 text-sm"><XCircle className="inline w-4 h-4 text-red-500 mr-1" />{String(hotboardMutation.error?.message)}</p>}
      </div>

      <div className="card card-padding space-y-4">
        <h2 className="section-title flex items-center gap-2"><Music className="w-4 h-4" />第三方歌单同步</h2>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单链接</label>
          <input type="text" value={playlistUrl} onChange={e => setPlaylistUrl(e.target.value)} placeholder="https://music.163.com/playlist?id=xxx" className="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">匹配阈值 ({playlistThreshold}%)</label>
            <input type="range" min={50} max={95} value={playlistThreshold} onChange={e => setPlaylistThreshold(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg accent-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空自动）</label>
            <input type="text" value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="自动从歌单名" className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={playlistOverwrite} onChange={e => setPlaylistOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-500" />
          覆盖同名歌单
        </label>
        <button onClick={() => playlistMutation.mutate()} disabled={!isPlaylistUrlValid(playlistUrl) || playlistMutation.isPending} className="btn-primary w-full">
          {playlistMutation.isPending ? '解析中...' : playlistMutation.isSuccess ? <><CheckCircle className="inline w-4 h-4 mr-1" />已提交，可前往推荐历史查看</> : playlistMutation.isError ? <><XCircle className="inline w-4 h-4 mr-1" />{String(playlistMutation.error?.message)}</> : <><Music className="w-4 h-4 inline mr-1" />解析并同步到 Navidrome</>}
        </button>
      </div>

      <div className="card card-padding space-y-4">
        <h2 className="section-title flex items-center gap-2"><FileText className="w-4 h-4" />文本歌单上传</h2>
        <p className="text-xs text-slate-400">上传 .txt 文件，每行格式：<code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">歌名 - 艺术家</code>，支持中/日/韩/英等任意语言</p>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">选择 .txt 文件</label>
          <input type="file" accept=".txt" onChange={e => { setTextFile(e.target.files?.[0] || null); textMutation.reset() }} className="input" />
          {textFile && <p className="text-xs text-slate-400 mt-1">已选择：{textFile.name}（{(textFile.size / 1024).toFixed(1)} KB）</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">匹配阈值 ({textThreshold}%)</label>
            <input type="range" min={50} max={95} value={textThreshold} onChange={e => setTextThreshold(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg accent-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空自动）</label>
            <input type="text" value={textPlaylistName} onChange={e => setTextPlaylistName(e.target.value)} placeholder="文本歌单" className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={textOverwrite} onChange={e => setTextOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-500" />
          覆盖同名歌单
        </label>
        <button onClick={() => textMutation.mutate()} disabled={!textFile || textMutation.isPending} className="btn-primary w-full">
          {textMutation.isPending ? '上传中...' : textMutation.isSuccess ? <><CheckCircle className="inline w-4 h-4 mr-1" />已提交</> : textMutation.isError ? <><XCircle className="inline w-4 h-4 mr-1" />{String(textMutation.error?.message)}</> : <><FileText className="w-4 h-4 inline mr-1" />上传并同步到 Navidrome</>}
        </button>
      </div>
    </div>
  )
}
