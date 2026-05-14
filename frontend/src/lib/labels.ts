export const RUN_TYPE_LABELS: Record<string, string> = {
  full: 'Last.fm 完整推荐',
  similar_tracks: 'Last.fm 相似曲目',
  similar_artists: 'Last.fm 相邻艺术家',
  hotboard: '网易云热榜同步',
  playlist: '第三方歌单同步',
  ai: 'AI 推荐',
}

export const RECOMMENDATION_CRON_RUN_TYPE_LABELS: Record<string, string> = {
  full: '完整推荐',
  similar_tracks: '仅相似曲目',
  similar_artists: '仅相邻艺术家',
}

export const PLAYLIST_TYPE_LABELS: Record<string, string> = {
  similar_tracks: 'Last.fm 相似曲目',
  similar_artists: 'Last.fm 相邻艺术家',
  hotboard: '网易云热榜',
  playlist_netease: '网易云歌单',
  playlist_text: '文本歌单',
  playlist_incremental: '歌单链接增量同步',
  ai_recommendation: 'AI 推荐歌单',
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  track_similarity: 'Last.fm 相似曲目',
  artist_similarity: 'Last.fm 相邻艺术家',
  hotboard: '网易云热榜',
  playlist: '导入歌单',
  playlist_netease: '网易云歌单',
  playlist_text: '文本歌单',
  playlist_incremental: '歌单链接增量',
  ai: 'AI 推荐',
}

export const LIBRARY_MODE_LABELS: Record<string, string> = {
  library_only: '仅保留曲库内歌曲',
  allow_missing: '允许缺失并通知',
}

export const MATCH_MODE_LABELS: Record<string, string> = {
  full: '完整匹配（本地 + Subsonic）',
  local: '仅本地索引',
  api: '仅 Subsonic',
}

export const RETRY_MODE_LABELS: Record<string, string> = {
  local: '仅本地索引',
  api: '仅 Subsonic',
  full: '完整匹配',
}

export const SEED_SOURCE_MODE_LABELS: Record<string, string> = {
  recent_only: '仅最近播放',
  top_only: '仅历史排行',
  recent_plus_top: '最近播放 + 历史排行',
}

export const TOP_PERIOD_LABELS: Record<string, string> = {
  '7day': '最近 7 天',
  '1month': '最近 1 个月',
  '3month': '最近 3 个月',
  '6month': '最近 6 个月',
  '12month': '最近 12 个月',
  overall: '全部时间',
}

export const MISSED_RETRY_MODE_LABELS: Record<string, string> = {
  local: '仅本地索引',
  api: '仅 Subsonic',
  full: '完整匹配（本地+Subsonic）',
}

export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  manual: '手动',
  scheduled: '定时',
}

export const MATCH_SOURCE_LABELS: Record<string, string> = {
  manual: '人工匹配',
  match_cache: '匹配缓存',
  memory: '内存索引',
  db_alias: '别名索引',
  db_fuzzy: '数据库模糊匹配',
  subsonic: 'Subsonic 实时搜索',
  miss: '未命中',
  local_only: '仅本地索引',
  full: '完整匹配',
}

export const SONG_SOURCE_LABELS: Record<string, string> = {
  sync: '全量同步',
  passive: '被动补充',
  manual: '人工添加',
  db: '数据库',
}

export const MISSED_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  matched: '已匹配',
  failed: '失败',
  ignored: '已忽略',
}

export const WEBHOOK_STATUS_LABELS: Record<string, string> = {
  pending: '等待发送',
  success: '成功',
  failed: '失败',
  retrying: '重试中',
}

export const COMMON_STATUS_LABELS: Record<string, string> = {
  success: '完成',
  completed: '完成',
  failed: '失败',
  error: '失败',
  running: '运行中',
  pending: '等待中',
  stopped: '已停止',
  partial_success: '部分成功',
  ignored: '已忽略',
  matched: '已匹配',
}

export function labelOf(
  map: Record<string, string>,
  value?: string | null,
  fallback = '-',
) {
  if (!value) return fallback
  return map[value] || value
}
