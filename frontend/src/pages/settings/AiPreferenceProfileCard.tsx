// frontend/src/pages/settings/AiPreferenceProfileCard.tsx

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/useToast'
import { useConfirm } from '@/components/ui'
import { SectionCard } from './SettingsShared'
import {
  deleteAiPreferenceProfile,
  fetchAiPreferenceProfile,
  updateAiPreferenceProfile,
  uploadAiPreferenceProfile,
} from './aiPreferenceApi'
import { formatDateTime } from '@/lib/date'

const EXAMPLE_PROFILE = `# SonicAI 长期音乐偏好

## 喜欢
- 喜欢日语女声、Dream Pop、Shoegaze、Ambient Pop
- 喜欢夜晚、雨天、低饱和、孤独感、漂浮感
- 推荐中可以有 40% 日语、40% 英语、20% 华语

## 不喜欢
- 不喜欢太吵的金属
- 不喜欢 EDM 大 Drop
- 不喜欢短视频热歌
- 尽量避免过度商业化的口水歌

## 推荐规则
- 每次推荐不要全是热门歌，可以混入一些小众歌曲
- 不要连续推荐同一个歌手超过 2 首
- 如果本次没有特别说明，默认适合夜晚听
`

export default function AiPreferenceProfileCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { confirmDanger } = useConfirm()

  const { data, isLoading } = useQuery({
    queryKey: ['ai-preference-profile'],
    queryFn: fetchAiPreferenceProfile,
  })

  const [content, setContent] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!data) return
    setContent(data.content || '')
    setEnabled(!!data.enabled)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAiPreferenceProfile({
        content,
        filename: data?.filename || 'preference.md',
        enabled,
      }),
    onSuccess: () => {
      toast.success('AI 长期偏好已保存')
      queryClient.invalidateQueries({ queryKey: ['ai-preference-profile'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error('保存失败', err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadAiPreferenceProfile,
    onSuccess: () => {
      toast.success('AI 长期偏好文件已上传')
      queryClient.invalidateQueries({ queryKey: ['ai-preference-profile'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error('上传失败', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAiPreferenceProfile,
    onSuccess: () => {
      toast.success('AI 长期偏好已删除')
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['ai-preference-profile'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error('删除失败', err.message),
  })

  return (
    <SectionCard
      title="AI 长期偏好文件"
      description="上传或编辑 Markdown/TXT 文本，作为每次 AI 推荐的长期约束。第一阶段不做结构化解析，只将原文加入 AI Prompt。"
      actions={
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" />
            上传 .md/.txt
            <input
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                uploadMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </label>

          <button
            type="button"
            className="btn-danger"
            disabled={deleteMutation.isPending || !data?.content}
            onClick={async () => {
              const ok = await confirmDanger('确定删除 AI 长期偏好文件吗？', '删除长期偏好')
              if (!ok) return
              deleteMutation.mutate()
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">加载 AI 长期偏好...</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">状态</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
                {enabled ? '已启用' : '未启用'}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">文件名</div>
              <div className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                {data?.filename || '-'}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">更新时间</div>
              <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
                {formatDateTime(data?.updated_at)}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded accent-cyan-500"
            />
            启用长期偏好文件
          </label>

          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              <FileText className="h-4 w-4" />
              偏好内容
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
              maxLength={50000}
              placeholder={EXAMPLE_PROFILE}
              className="input min-h-72 resize-y font-mono text-xs leading-relaxed"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>支持 Markdown/TXT，自由书写长期偏好、避免项、语种比例等。</span>
              <span>{content.length}/50000</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? '保存中...' : '保存长期偏好'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (!content.trim()) {
                  setContent(EXAMPLE_PROFILE)
                  return
                }
                setContent(prev => `${prev.trim()}\n\n${EXAMPLE_PROFILE}`)
              }}
            >
              插入示例模板
            </button>
          </div>

          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
            长期偏好文件是全局配置。AI 推荐执行页可以选择是否使用它。本阶段后端不会解析黑名单，也不会做歌手硬过滤。
          </div>
        </div>
      )}
    </SectionCard>
  )
}