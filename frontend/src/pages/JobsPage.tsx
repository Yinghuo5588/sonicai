import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { useToast } from '@/components/ui/useToast'
import {
  Sparkles,
  Music,
  FileText,
  CheckCircle,
  XCircle,
  Zap,
  AudioLines,
  Users,
  Star,
} from 'lucide-react'
import { MATCH_MODE_LABELS, labelOf } from '@/lib/labels'

async function fetchSettings() {
  return apiFetch('/settings')
}

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

/* ---------- 任务卡片组件 ---------- */
function ActionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="card card-padding space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

/* ---------- 结果提示 ---------- */
function ResultTip({
  isSuccess,
  isError,
  error,
}: {
  isSuccess: boolean
  isError: boolean
  error?: unknown
}) {
  if (isSuccess) {
    return (
      <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
        <CheckCircle className="w-3.5 h-3.5" />已提交，可在推荐历史查看进度
      </p>
    )
  }
  if (isError) {
    return (
      <p className="text-red-500 text-xs flex items-center gap-1">
        <XCircle className="w-3.5 h-3.5" />{String((error as any)?.message || '操作失败')}
      </p>
    )
  }
  return null
}

/* ---------- Last.fm 操作行 ---------- */
function LastfmActionRow({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  loading,
  success,
  error,
}: {
  icon: React.ElementType
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
  loading: boolean
  success: boolean
  error: unknown
}) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50/70 dark:bg-slate-900/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {description}
          </div>
          <ResultTip isSuccess={success} isError={!!error} error={error} />
        </div>
      </div>

      <button
        onClick={onClick}
        disabled={loading}
        className="btn-primary w-full sm:w-auto shrink-0"
      >
        {loading ? '执行中...' : success ? (
          <><CheckCircle className="w-4 h-4 mr-1" />已提交</>
        ) : error ? (
          <><XCircle className="w-4 h-4 mr-1" />失败，重试</>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  )
}

/* ---------- Range Slider ---------- */
function RangeSlider({
  label,
  value,
  onChange,
  min = 50,
  max = 95,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-medium text-cyan-600 dark:text-cyan-300">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg accent-cyan-500"
      />
    </div>
  )
}

export default function JobsPage() {
  const toast = useToast()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  /* 推荐任务 */
  const allMutation = useMutation({
    mutationFn: () => triggerJob('all'),
    onSuccess: (data: any) => {
      toast.success('推荐任务已提交', `Run ID: ${data?.run_id ?? '-'}`)
    },
    onError: (error: Error) => {
      toast.error('推荐任务提交失败', error.message)
    },
  })
  const tracksMutation = useMutation({ mutationFn: () => triggerJob('similar-tracks') })
  const artistsMutation = useMutation({ mutationFn: () => triggerJob('similar-artists') })

  /* 网易云热榜 */
  const [limit, setLimit] = useState(50)
  const [threshold, setThreshold] = useState(75)
  const [hotboardName, setHotboardName] = useState('')
  const [hotboardOverwrite, setHotboardOverwrite] = useState(false)
  const hotboardMutation = useMutation({
    mutationFn: () => triggerHotboard(limit, threshold, hotboardName, hotboardOverwrite),
    onSuccess: (data: any) => {
      toast.success('热榜同步已提交', `Run ID: ${data?.run_id ?? '-'}`)
    },
    onError: (error: Error) => {
      toast.error('热榜同步失败', error.message)
    },
  })

  /* 第三方歌单 */
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistThreshold, setPlaylistThreshold] = useState(75)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistOverwrite, setPlaylistOverwrite] = useState(false)
  const playlistMutation = useMutation({
    mutationFn: () => triggerPlaylistSync(playlistUrl, playlistThreshold / 100, playlistName, playlistOverwrite),
    onSuccess: (data: any) => {
      toast.success('歌单同步已提交', `Run ID: ${data?.run_id ?? '-'}`)
    },
    onError: (error: Error) => {
      toast.error('歌单同步失败', error.message)
    },
  })

  /* 文本歌单 */
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

  const isPlaylistUrlValid = (v: string) =>
    /https?:\/\//.test(v) &&
    (v.includes('163') || v.includes('qq.com') || v.includes('qishui') || v.includes('douyin.com'))

  return (
    <div className="page">
      <div>
        <h1 className="page-title">任务执行</h1>
        <p className="page-subtitle mt-1">手动触发推荐任务、同步第三方歌单或上传文本歌单。</p>
      </div>

      {/* Preflight check */}
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">全局服务状态</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={`flex items-center gap-1.5 text-xs ${!!settings?.lastfm_api_key ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {!!settings?.lastfm_api_key ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
            Last.fm API Key
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${!!settings?.lastfm_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {!!settings?.lastfm_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
            Last.fm 用户名
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${!!settings?.navidrome_url && !!settings?.navidrome_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {!!settings?.navidrome_url && !!settings?.navidrome_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
            Navidrome 配置
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${!!settings?.match_mode ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {!!settings?.match_mode ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
            匹配模式：{labelOf(MATCH_MODE_LABELS, settings?.match_mode)}
          </div>
        </div>
      </div>

      {/* Last.fm 推荐歌单生成 */}
      <ActionCard
        icon={Sparkles}
        title="Last.fm 推荐歌单生成"
        description="基于 Last.fm 听歌数据生成推荐歌单，并同步到 Navidrome"
      >
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 space-y-1.5 mb-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            全局服务状态
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`flex items-center gap-1.5 text-xs ${!!settings?.lastfm_api_key ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {!!settings?.lastfm_api_key ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              Last.fm API Key
            </div>
            <div className={`flex items-center gap-1.5 text-xs ${!!settings?.lastfm_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {!!settings?.lastfm_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              Last.fm 用户名
            </div>
            <div className={`flex items-center gap-1.5 text-xs ${!!settings?.navidrome_url && !!settings?.navidrome_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {!!settings?.navidrome_url && !!settings?.navidrome_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              Navidrome 配置
            </div>
            <div className={`flex items-center gap-1.5 text-xs ${!!settings?.match_mode ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {!!settings?.match_mode ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              匹配模式：{labelOf(MATCH_MODE_LABELS, settings?.match_mode)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <LastfmActionRow
            icon={Zap}
            title="完整推荐"
            description="同时生成相似曲目和相邻艺术家两个推荐歌单"
            buttonLabel="执行完整推荐"
            onClick={() => allMutation.mutate()}
            loading={allMutation.isPending}
            success={allMutation.isSuccess}
            error={allMutation.error}
          />
          <LastfmActionRow
            icon={AudioLines}
            title="相似曲目"
            description="基于用户常听曲目，生成相似歌曲歌单"
            buttonLabel="仅生成相似曲目"
            onClick={() => tracksMutation.mutate()}
            loading={tracksMutation.isPending}
            success={tracksMutation.isSuccess}
            error={tracksMutation.error}
          />
          <LastfmActionRow
            icon={Users}
            title="相邻艺术家"
            description="基于用户喜爱的艺术家，生成相邻艺术家热门歌曲歌单"
            buttonLabel="仅生成相邻艺术家"
            onClick={() => artistsMutation.mutate()}
            loading={artistsMutation.isPending}
            success={artistsMutation.isSuccess}
            error={artistsMutation.error}
          />
        </div>
      </ActionCard>

      {/* 网易云热榜同步 */}
      <ActionCard icon={Star} title="网易云热榜同步" description="抓取网易云音乐热榜歌曲，同步到 Navidrome">
        <div className="space-y-3">
          {/* Preflight */}
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">执行前检查</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className={`flex items-center gap-1.5 text-xs ${!!settings?.navidrome_url && !!settings?.navidrome_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {!!settings?.navidrome_url && !!settings?.navidrome_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                Navidrome 配置
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${Number(limit) >= 1 && Number(limit) <= 200 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {Number(limit) >= 1 && Number(limit) <= 200 ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                抓取数量 1-200
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${threshold >= 50 && threshold <= 95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {threshold >= 50 && threshold <= 95 ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                匹配阈值 {threshold}%
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">抓取热榜歌曲数</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="input"
            />
          </div>
          <RangeSlider label="匹配阈值" value={threshold} onChange={setThreshold} />
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空则自动生成）</label>
            <input
              type="text"
              value={hotboardName}
              onChange={e => setHotboardName(e.target.value)}
              placeholder="网易云热榜 - 2026-04-25"
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hotboardOverwrite}
              onChange={e => setHotboardOverwrite(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
            覆盖同名歌单
          </label>
          <button
            onClick={() => hotboardMutation.mutate()}
            disabled={hotboardMutation.isPending}
            className="btn-primary w-full"
          >
            {hotboardMutation.isPending ? '同步中...' : hotboardMutation.isSuccess ? <><CheckCircle className="w-4 h-4 mr-1" />已提交</> : hotboardMutation.isError ? <><XCircle className="w-4 h-4 mr-1" />失败</> : '同步网易云热榜'}
          </button>
          <ResultTip isSuccess={hotboardMutation.isSuccess} isError={hotboardMutation.isError} error={hotboardMutation.error} />
        </div>
      </ActionCard>

      {/* 第三方歌单同步 */}
      <ActionCard icon={Music} title="第三方歌单同步" description="导入网易云、QQ 音乐等平台歌单，同步到 Navidrome">
        <div className="space-y-3">
          {/* Preflight */}
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">执行前检查</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className={`flex items-center gap-1.5 text-xs ${!!settings?.playlist_api_url ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {!!settings?.playlist_api_url ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                Playlist API 地址
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${!!settings?.navidrome_url && !!settings?.navidrome_username ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {!!settings?.navidrome_url && !!settings?.navidrome_username ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                Navidrome 配置
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${!!settings?.match_threshold ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {!!settings?.match_threshold ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                默认阈值：{Math.round(Number(settings?.match_threshold || 0.75) * 100)}%
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">歌单链接</label>
            <input
              type="text"
              value={playlistUrl}
              onChange={e => setPlaylistUrl(e.target.value)}
              placeholder="https://music.163.com/playlist?id=xxx"
              className="input"
            />
          </div>
          <RangeSlider label="匹配阈值" value={playlistThreshold} onChange={setPlaylistThreshold} />
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空自动）</label>
            <input
              type="text"
              value={playlistName}
              onChange={e => setPlaylistName(e.target.value)}
              placeholder="自动从歌单名"
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={playlistOverwrite}
              onChange={e => setPlaylistOverwrite(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
            覆盖同名歌单
          </label>
          <button
            onClick={() => playlistMutation.mutate()}
            disabled={!isPlaylistUrlValid(playlistUrl) || playlistMutation.isPending}
            className="btn-primary w-full"
          >
            {playlistMutation.isPending ? '解析中...' : playlistMutation.isSuccess ? (
              <><CheckCircle className="w-4 h-4 mr-1" />已提交</>
            ) : playlistMutation.isError ? (
              <><XCircle className="w-4 h-4 mr-1" />{String(playlistMutation.error?.message)}</>
            ) : (
              <><Music className="w-4 h-4 mr-1" />解析并同步到 Navidrome</>
            )}
          </button>
          <ResultTip isSuccess={playlistMutation.isSuccess} isError={playlistMutation.isError} error={playlistMutation.error} />
        </div>
      </ActionCard>

      {/* 文本歌单上传 */}
      <ActionCard icon={FileText} title="文本歌单上传" description="上传 .txt 文件，每行格式：歌名 - 艺术家">
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">选择 .txt 文件</label>
            <input
              type="file"
              accept=".txt"
              onChange={e => {
                setTextFile(e.target.files?.[0] || null)
                textMutation.reset()
              }}
              className="input"
            />
            {textFile && (
              <p className="text-[11px] text-slate-400 mt-1">
                已选择：{textFile.name}（{(textFile.size / 1024).toFixed(1)} KB）
              </p>
            )}
          </div>
          <RangeSlider label="匹配阈值" value={textThreshold} onChange={setTextThreshold} />
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">歌单名称（留空自动）</label>
            <input
              type="text"
              value={textPlaylistName}
              onChange={e => setTextPlaylistName(e.target.value)}
              placeholder="文本歌单"
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={textOverwrite}
              onChange={e => setTextOverwrite(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded"
            />
            覆盖同名歌单
          </label>
          <button
            onClick={() => textMutation.mutate()}
            disabled={!textFile || textMutation.isPending}
            className="btn-primary w-full"
          >
            {textMutation.isPending ? '上传中...' : textMutation.isSuccess ? (
              <><CheckCircle className="w-4 h-4 mr-1" />已提交</>
            ) : textMutation.isError ? (
              <><XCircle className="w-4 h-4 mr-1" />{String(textMutation.error?.message)}</>
            ) : (
              <><FileText className="w-4 h-4 mr-1" />上传并同步到 Navidrome</>
            )}
          </button>
          <ResultTip isSuccess={textMutation.isSuccess} isError={textMutation.isError} error={textMutation.error} />
        </div>
      </ActionCard>
    </div>
  )
}