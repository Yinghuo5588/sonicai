import { FormSkeleton } from '@/components/ui/Skeleton'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  useSettingsForm,
} from './SettingsShared'

export default function SettingsSource() {
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
    <div className="space-y-4">
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

      <SaveBar
        hasChanges={hasChanges}
        isPending={mutation.isPending}
        isSuccess={mutation.isSuccess}
        isError={mutation.isError}
        onSave={save}
      />
    </div>
  )
}
