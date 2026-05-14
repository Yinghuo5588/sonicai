import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import {
  FieldInput,
  SaveBar,
  SectionCard,
  Tooltip,
  testNavidrome,
  testWebhook,
  useSettingsForm,
} from './SettingsShared'
import { useToast } from '@/components/ui/useToast'
import { FormSkeleton } from '@/components/ui/Skeleton'


export default function SettingsConnections() {
  const {
    s,
    isLoading,
    mutation,
    hasChanges,
    handleChange,
    save,
  } = useSettingsForm()

  const toast = useToast()
  const [navidromeResult, setNavidromeResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [navidromeLoading, setNavidromeLoading] = useState(false)

  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <FormSkeleton fields={4} />
        <FormSkeleton fields={3} />
        <FormSkeleton fields={4} />
      </div>
    )
  }

  const handleTestNavidrome = async () => {
    setNavidromeLoading(true)
    setNavidromeResult(null)

    try {
      const result = await testNavidrome()
      setNavidromeResult({ ok: true, msg: result.message || '连接成功' })
      toast.success('Navidrome 连接成功', result.message || '服务正常')
    } catch (err: any) {
      setNavidromeResult({ ok: false, msg: err.message })
      toast.error('Navidrome 连接失败', err.message)
    } finally {
      setNavidromeLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setWebhookLoading(true)
    setWebhookResult(null)

    try {
      const result = await testWebhook()
      setWebhookResult({ ok: true, msg: result.message || '连接成功' })
      toast.success('Webhook 测试成功', result.message || '服务正常')
    } catch (err: any) {
      setWebhookResult({ ok: false, msg: err.message })
      toast.error('Webhook 测试失败', err.message)
    } finally {
      setWebhookLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="AI 推荐">
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!s.ai_enabled}
              onChange={e => handleChange('ai_enabled', e.target.checked)}
              className="h-4 w-4 accent-cyan-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              启用 AI 推荐
            </span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                AI API Key
                <Tooltip text="OpenAI-compatible API Key。导出配置时应脱敏。" />
              </label>
              <input
                type="password"
                value={String(s.ai_api_key ?? '')}
                onChange={e => handleChange('ai_api_key', e.target.value)}
                className="input"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                模型
                <Tooltip text="例如 gpt-4o-mini、deepseek-chat、qwen-plus、llama3.1 等。" />
              </label>
              <input
                type="text"
                value={String(s.ai_model ?? '')}
                onChange={e => handleChange('ai_model', e.target.value)}
                className="input"
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Base URL
              <Tooltip text="OpenAI-compatible API 地址。例如 https://api.openai.com/v1 或 https://api.deepseek.com/v1。" />
            </label>
            <input
              type="text"
              value={String(s.ai_base_url ?? '')}
              onChange={e => handleChange('ai_base_url', e.target.value)}
              className="input"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                请求超时（秒）
              </label>
              <input
                type="number"
                min={10}
                max={300}
                value={Number(s.ai_request_timeout ?? 60)}
                onChange={e => handleChange('ai_request_timeout', Number(e.target.value))}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                默认数量
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={Number(s.ai_default_limit ?? 30)}
                onChange={e => handleChange('ai_default_limit', Number(e.target.value))}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Temperature
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={Number(s.ai_temperature ?? 0.8)}
                onChange={e => handleChange('ai_temperature', Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              收藏样本数量
              <Tooltip text="收藏个性化模式使用多少首 Navidrome 收藏歌曲作为 AI 上下文。默认 40，建议 20-80。" />
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={Number(s.ai_favorites_sample_limit ?? 40)}
              onChange={e => handleChange('ai_favorites_sample_limit', Number(e.target.value))}
              className="input"
            />
          </div>

          

      <SectionCard title="Last.fm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              API Key
              <Tooltip text="Last.fm API Key" />
            </label>
            <input
              type="text"
              value={String(s.lastfm_api_key ?? '')}
              onChange={e => handleChange('lastfm_api_key', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              用户名
              <Tooltip text="Last.fm 用户名" />
            </label>
            <input
              type="text"
              value={String(s.lastfm_username ?? '')}
              onChange={e => handleChange('lastfm_username', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Navidrome">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <span className="text-xs text-slate-400">测试与 Navidrome 服务器的连通性</span>
          <button
            onClick={handleTestNavidrome}
            disabled={navidromeLoading || !s.navidrome_url}
            className="btn-secondary"
          >
            {navidromeLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>

        {navidromeResult && (
          <p
            className={`text-xs px-3 py-2 rounded-lg mb-3 ${
              navidromeResult.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            }`}
          >
            {navidromeResult.ok ? (
              <>
                <CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />
                {navidromeResult.msg}
              </>
            ) : (
              <>
                <XCircle className="inline w-4 h-4 text-red-500 mr-1" />
                {navidromeResult.msg}
              </>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              地址
              <Tooltip text="Navidrome 服务器地址" />
            </label>
            <input
              type="text"
              value={String(s.navidrome_url ?? '')}
              onChange={e => handleChange('navidrome_url', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={String(s.navidrome_username ?? '')}
              onChange={e => handleChange('navidrome_username', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              密码
            </label>
            <input
              type="password"
              value={String(s.navidrome_password ?? '')}
              onChange={e => handleChange('navidrome_password', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Webhook">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <span className="text-xs text-slate-400">测试 Webhook URL 连通性</span>
          <button
            onClick={handleTestWebhook}
            disabled={webhookLoading || !s.webhook_url}
            className="btn-secondary"
          >
            {webhookLoading ? '检测中...' : '检测连通性'}
          </button>
        </div>

        {webhookResult && (
          <p
            className={`text-xs px-3 py-2 rounded-lg mb-3 ${
              webhookResult.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            }`}
          >
            {webhookResult.ok ? (
              <>
                <CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />
                {webhookResult.msg}
              </>
            ) : (
              <>
                <XCircle className="inline w-4 h-4 text-red-500 mr-1" />
                {webhookResult.msg}
              </>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Webhook URL
            </label>
            <input
              type="text"
              value={String(s.webhook_url ?? '')}
              onChange={e => handleChange('webhook_url', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              Headers JSON
            </label>
            <input
              type="text"
              value={String(s.webhook_headers_json ?? '')}
              onChange={e => handleChange('webhook_headers_json', e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <FieldInput
            fieldKey="webhook_timeout_seconds"
            value={s.webhook_timeout_seconds}
            onChange={v => handleChange('webhook_timeout_seconds', v)}
          />
          <FieldInput
            fieldKey="webhook_retry_count"
            value={s.webhook_retry_count}
            onChange={v => handleChange('webhook_retry_count', v)}
          />
        </div>
      </SectionCard>

      <SectionCard title="歌单解析">
        <FieldInput
          fieldKey="playlist_api_url"
          value={s.playlist_api_url}
          onChange={v => handleChange('playlist_api_url', v)}
        />
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
