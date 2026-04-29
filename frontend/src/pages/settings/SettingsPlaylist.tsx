import RecommendPreview from '@/components/RecommendPreview'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  useSettingsForm,
} from './SettingsShared'

export default function SettingsPlaylist() {
  const {
    s,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  if (isLoading) return <div className="p-4 text-slate-500">加载中...</div>

  return (
    <div className="space-y-4">
      <SectionCard title="歌单规模">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput
            fieldKey="similar_playlist_size"
            value={s.similar_playlist_size}
            onChange={v => handleChange('similar_playlist_size', v)}
          />
          <FieldInput
            fieldKey="artist_playlist_size"
            value={s.artist_playlist_size}
            onChange={v => handleChange('artist_playlist_size', v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="推荐平衡与预览">
        <FieldInput
          fieldKey="recommendation_balance"
          value={s.recommendation_balance}
          onChange={v => handleChange('recommendation_balance', v)}
        />

        <RecommendPreview
          seedCount={Number(s.top_track_seed_limit) || 30}
          similarPerSeed={Number(s.similar_track_limit) || 30}
          playlistSize={Number(s.similar_playlist_size) || 30}
          balance={Number(s.recommendation_balance) || 55}
          threshold={Number(s.match_threshold) || 0.75}
        />
      </SectionCard>

      <SectionCard title="匹配与搜索">
        <div className="space-y-3">
          <FieldInput
            fieldKey="match_threshold"
            value={s.match_threshold}
            onChange={v => handleChange('match_threshold', v)}
          />
          <FieldInput
            fieldKey="search_concurrency"
            value={s.search_concurrency}
            onChange={v => handleChange('search_concurrency', v)}
          />
          <FieldInput
            fieldKey="duplicate_avoid_days"
            value={s.duplicate_avoid_days}
            onChange={v => handleChange('duplicate_avoid_days', v)}
          />
          <FieldInput
            fieldKey="library_mode_default"
            value={s.library_mode_default}
            onChange={v => handleChange('library_mode_default', v)}
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
