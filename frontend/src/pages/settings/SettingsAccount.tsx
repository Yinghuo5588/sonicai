import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, LogOut, XCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { useAuthStore } from '@/hooks/useAuth'
import { changePasswordSchema } from '@/lib/validators'
import { SectionCard } from './SettingsShared'

export default function SettingsAccount() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleChangePassword = async () => {
    setPasswordLoading(true)
    setPasswordResult(null)

    const validation = changePasswordSchema.safeParse({
      oldPassword,
      newPassword,
    })

    if (!validation.success) {
      setPasswordResult({
        ok: false,
        msg: validation.error.errors[0].message,
      })
      setPasswordLoading(false)
      return
    }

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          old_password: validation.data.oldPassword,
          new_password: validation.data.newPassword,
        }),
      })

      setPasswordResult({ ok: true, msg: '密码修改成功' })
      setOldPassword('')
      setNewPassword('')
    } catch (err: any) {
      setPasswordResult({ ok: false, msg: err.message })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {}

    logout()
    navigate('/login', { replace: true })
  }

  const handleExport = async () => {
    try {
      const data = await apiFetch('/settings/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = `sonicai-config-${new Date().toISOString().slice(0, 10)}.json`
      a.click()

      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('导出失败: ' + (err.message || '未知错误'))
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportResult(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      if (!json.settings || typeof json.settings !== 'object') {
        throw new Error('无效配置文件')
      }

      const result = await apiFetch('/settings/import', {
        method: 'POST',
        body: JSON.stringify({
          settings: json.settings,
        }),
      })

      setImportResult({
        ok: true,
        msg: `导入成功，更新了 ${result.updated_fields.length} 个字段`,
      })

      queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err: any) {
      setImportResult({
        ok: false,
        msg: '导入失败: ' + (err.message || '未知错误'),
      })
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="修改密码">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              旧密码
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              新密码，至少 6 位
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={!oldPassword || newPassword.length < 6 || passwordLoading}
            className="btn-primary w-full sm:w-auto"
          >
            {passwordLoading ? '修改中...' : '修改密码'}
          </button>

          {passwordResult && (
            <p className={`text-sm ${passwordResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {passwordResult.ok ? (
                <>
                  <CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />
                  密码修改成功
                </>
              ) : (
                <>
                  <XCircle className="inline w-4 h-4 text-red-500 mr-1" />
                  {passwordResult.msg}
                </>
              )}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="登录状态">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              退出当前账号
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              退出后需要重新登录才能访问 SonicAI。
            </p>
          </div>

          <button onClick={handleLogout} className="btn-danger w-full sm:w-auto">
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </SectionCard>

      <SectionCard title="配置备份">
        <p className="text-xs text-slate-400 mb-3">
          导出或导入全部配置，JSON 格式。迁移时请注意备份 .env 中的 JWT_SECRET_KEY。
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExport} className="btn-secondary">
            导出配置
          </button>

          <label className="btn-secondary cursor-pointer">
            导入配置
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        {importResult && (
          <p className={`text-sm ${importResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {importResult.msg}
          </p>
        )}
      </SectionCard>
    </div>
  )
}
