import { useState } from 'react'
import { FileText, Radio } from 'lucide-react'
import { FormSkeleton } from '@/components/ui/Skeleton'
import BottomSheetToolSelector, { type ToolOption } from '@/components/ui/BottomSheetToolSelector'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  useSettingsForm,
} from './SettingsShared'
import AiPreferenceProfileCard from './AiPreferenceProfileCard'

type SourcePanel = 'lastfm' | 'ai-strategy'

const SOURCE_OPTIONS: ToolOption[] = [
  {
    key: 'lastfm',
    label: 'LastFM策略',
    description: '配置种子策略与数据获取数量',
    icon: Radio,
  },
  {
    key: 'ai-strategy',
    label: 'AI推荐策略',
    description: '配置 AI 推荐开关与长期偏好',
    icon: FileText,
  },
]

export default function SettingsSource() {
  const [activePanel, setActivePanel] = useState<SourcePanel>('lastfm')

  const {
    s,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  if (isLoading) {
    return <div className="space-y-4"><FormSkeleton fields={4} /><FormSkeleton fields={3} /><FormSkeleton fields={4} /></div>
  }

  return (
    <div className="space-y-4 pb-16">
      {activePanel === 'lastfm' && (
        <>
          <SectionCard title="种子抓取策略">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput
                fieldKey="seed_source_mode"
                value={s.seed_source_mode}
                onChange={v => handleChange('seed_source_mode', v)}
              />

              {(s.seed_source_mode === 'recent_only' || s.seed_source_mode === 'recent_plus_top') && (
                <FieldInput
                  fieldKey="recent_tracks_limit"
                  value={s.recent_tracks_limit}
                  onChange={v => handleChange('recent_tracks_limit', v)}
                />
              )}

              {(s.seed_source_mode === 'top_only' || s.seed_source_mode === 'recent_plus_top') && (
                <FieldInput
                  fieldKey="top_period"
                  value={s.top_period}
                  onChange={v => handleChange('top_period', v)}
                />
              )}

              {s.seed_source_mode === 'recent_plus_top' && (
                <FieldInput
                  fieldKey="recent_top_mix_ratio"
                  value={s.recent_top_mix_ratio}
                  onChange={v => handleChange('recent_top_mix_ratio', v)}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard title="获取数量控制">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput
                fieldKey="top_track_seed_limit"
                value={s.top_track_seed_limit}
                onChange={v => handleChange('top_track_seed_limit', v)}
              />
              <FieldInput
                fieldKey="top_artist_seed_limit"
                value={s.top_artist_seed_limit}
                onChange={v => handleChange('top_artist_seed_limit', v)}
              />
              <FieldInput
                fieldKey="similar_track_limit"
                value={s.similar_track_limit}
                onChange={v => handleChange('similar_track_limit', v)}
              />
              <FieldInput
                fieldKey="similar_artist_limit"
                value={s.similar_artist_limit}
                onChange={v => handleChange('similar_artist_limit', v)}
              />
              <FieldInput
                fieldKey="artist_top_track_limit"
                value={s.artist_top_track_limit}
                onChange={v => handleChange('artist_top_track_limit', v)}
              />
            </div>
          </SectionCard>
        </>
      )}

      {activePanel === 'ai-strategy' && (
        <div className="space-y-4">
          <SectionCard title="AI 推荐策略">
            <FieldInput
              fieldKey="ai_preference_profile_enabled"
              value={s.ai_preference_profile_enabled}
              onChange={v => handleChange('ai_preference_profile_enabled', v)}
            />

            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
              开启后，AI 推荐会默认加入长期偏好文件内容；执行 AI 推荐任务时仍可单独选择是否使用长期偏好文件。
            </div>
          </SectionCard>

          <AiPreferenceProfileCard />
        </div>
      )}

      <SaveBar
        hasChanges={hasChanges}
        isPending={mutation.isPending}
        isSuccess={mutation.isSuccess}
        isError={mutation.isError}
        onSave={save}
      />

      <BottomSheetToolSelector
        options={SOURCE_OPTIONS}
        activeKey={activePanel}
        onChange={k => setActivePanel(k as SourcePanel)}
        fabLabel="推荐策略"
      />
    </div>
  )
}