// frontend/src/pages/settings/library/MatchDebugCard.tsx

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FieldInput, SaveBar, SectionCard, useSettingsForm } from '../SettingsShared'
import { debugMatch } from './libraryApi'
import DebugMatchResultView from './components/DebugMatchResultView'

export default function MatchDebugCard() {
  const { s, isLoading, mutation, hasChanges, handleChange, save } = useSettingsForm()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [threshold, setThreshold] = useState(0.75)

  const debugMutation = useMutation({ mutationFn: debugMatch })

  return (
    <>
      <SaveBar hasChanges={hasChanges} isPending={mutation.isPending} isSuccess={mutation.isSuccess} isError={mutation.isError} onSave={save} />
      <div className="space-y-4">
        <SectionCard title="调试设置">
          {isLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">加载调试设置...</div>
          ) : (
            <>
              <FieldInput fieldKey="match_debug_enabled" value={s.match_debug_enabled} onChange={v => handleChange('match_debug_enabled', v)} />
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                开启后，新产生的匹配日志会写入完整链路 steps，包括 manual_match、match_cache、memory、db_alias、db_fuzzy、subsonic 等步骤。该功能会增加 match_log.raw_json 的写入体积，建议仅在排查问题时开启。
              </div>
            </>
          )}
        </SectionCard>

      <SectionCard title="匹配诊断">
        <p className="text-xs text-slate-500 dark:text-slate-400">输入歌名和艺术家，查看标准化结果、别名、最终匹配来源和得分。</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="歌名，例如: 如果呢" className="input" />
          <input type="text" value={artist} onChange={e => setArtist(e.target.value)} placeholder="艺术家，例如: 郑润泽" className="input" />
          <div>
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">阈值: {Math.round(threshold * 100)}%</div>
            <input
              type="range" min={50} max={95}
              value={Math.round(threshold * 100)}
              onChange={e => setThreshold(Number(e.target.value) / 100)}
              className="w-full accent-orange-500"
            />
          </div>
        </div>
        <button
          type="button" className="btn-primary mt-3"
          disabled={!title.trim() || debugMutation.isPending}
          onClick={() => debugMutation.mutate({ title, artist, threshold })}
        >
          {debugMutation.isPending ? '诊断中...' : '开始诊断'}
        </button>
        {debugMutation.isError && (
          <p className="mt-2 text-sm text-red-500">诊断失败: {(debugMutation.error as Error).message}</p>
        )}
        {debugMutation.data && <DebugMatchResultView data={debugMutation.data} />}
      </SectionCard>
    </div>
    </>
  )
}