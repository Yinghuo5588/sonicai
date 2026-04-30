import {
  FieldInput,
  SaveBar,
  SectionCard,
  Tooltip,
  useSettingsForm,
} from './SettingsShared'

export default function SettingsSchedule() {
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
      <SectionCard title="推荐定时任务">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.cron_enabled}
            onChange={e => handleChange('cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">启用定时推荐</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Cron 表达式<Tooltip text="分 时 日 月 周" />
          </label>
          <input
            type="text"
            value={String(s.cron_expression ?? '')}
            onChange={e => handleChange('cron_expression', e.target.value)}
            className="input"
          />
        </div>
      </SectionCard>

      <SectionCard title="网易云热榜定时同步">
        <p className="text-xs text-slate-400 mb-3">定时从网易云抓取热榜并同步到 Navidrome</p>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.hotboard_cron_enabled}
            onChange={e => handleChange('hotboard_cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">启用热榜定时同步</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              value={String(s.hotboard_cron_expression ?? '')}
              onChange={e => handleChange('hotboard_cron_expression', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">抓取数量</label>
            <input
              type="number"
              min={1}
              max={200}
              value={Number(s.hotboard_limit ?? 50)}
              onChange={e => handleChange('hotboard_limit', Number(e.target.value))}
              className="input"
            />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {Math.round((s.hotboard_match_threshold ?? 0.75) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            value={Number((s.hotboard_match_threshold ?? 0.75) * 100)}
            onChange={e => handleChange('hotboard_match_threshold', Number(e.target.value) / 100)}
            className="w-full accent-orange-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="歌单名称（留空自动）"
            value={String(s.hotboard_playlist_name ?? '')}
            onChange={e => handleChange('hotboard_playlist_name', e.target.value)}
            className="input"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!s.hotboard_overwrite}
              onChange={e => handleChange('hotboard_overwrite', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            覆盖同名歌单
          </label>
        </div>
      </SectionCard>

      <SectionCard title="歌单链接定时同步">
        <p className="text-xs text-slate-400 mb-3">监控指定歌单链接，变化时自动增量同步到 Navidrome</p>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={!!s.playlist_sync_cron_enabled}
            onChange={e => handleChange('playlist_sync_cron_enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">启用歌单定时同步</span>
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              placeholder="0 */6 * * * (每6小时)"
              value={String(s.playlist_sync_cron_expression ?? '')}
              onChange={e => handleChange('playlist_sync_cron_expression', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单链接</label>
            <input
              type="text"
              placeholder="https://music.163.com/playlist?id=xxx"
              value={String(s.playlist_sync_url ?? '')}
              onChange={e => handleChange('playlist_sync_url', e.target.value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">匹配阈值</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {Math.round((s.playlist_sync_threshold ?? 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={Number((s.playlist_sync_threshold ?? 0.75) * 100)}
                onChange={e => handleChange('playlist_sync_threshold', Number(e.target.value) / 100)}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">歌单名称</label>
              <input
                type="text"
                placeholder="留空自动"
                value={String(s.playlist_sync_name ?? '')}
                onChange={e => handleChange('playlist_sync_name', e.target.value)}
                className="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!s.playlist_sync_overwrite}
              onChange={e => handleChange('playlist_sync_overwrite', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            每次全量覆盖（默认增量追加新歌）
          </label>
        </div>
      </SectionCard>

      <SectionCard title="缺失歌曲定时重试">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          定时重试未命中歌曲。建议在补库后开启,并启用「重试前刷新曲库索引」。
        </p>

        <FieldInput
          fieldKey="missed_track_retry_enabled"
          value={s.missed_track_retry_enabled}
          onChange={v => handleChange('missed_track_retry_enabled', v)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
            <input
              type="text"
              value={String(s.missed_track_retry_cron ?? '0 3 * * *')}
              onChange={e => handleChange('missed_track_retry_cron', e.target.value)}
              className="input"
            />
          </div>
          <FieldInput
            fieldKey="missed_track_retry_limit"
            value={s.missed_track_retry_limit}
            onChange={v => handleChange('missed_track_retry_limit', v)}
          />
        </div>

        <FieldInput
          fieldKey="missed_track_retry_refresh_library"
          value={s.missed_track_retry_refresh_library}
          onChange={v => handleChange('missed_track_retry_refresh_library', v)}
        />

        <FieldInput
          fieldKey="missed_track_retry_mode"
          value={s.missed_track_retry_mode}
          onChange={v => handleChange('missed_track_retry_mode', v)}
        />
      </SectionCard>

      <SectionCard title="任务管理">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput
            fieldKey="playlist_keep_days"
            value={s.playlist_keep_days}
            onChange={v => handleChange('playlist_keep_days', v)}
          />
          <FieldInput
            fieldKey="max_concurrent_tasks"
            value={s.max_concurrent_tasks}
            onChange={v => handleChange('max_concurrent_tasks', v)}
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
