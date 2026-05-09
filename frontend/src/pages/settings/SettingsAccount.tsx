import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, LogOut, XCircle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import { useAuthStore } from '@/hooks/useAuth'
import { changePasswordSchema, changeUsernameSchema } from '@/lib/validators'
import { SectionCard } from './SettingsShared'
import { useToast } from '@/components/ui/useToast'
import { ThemeMode, useTheme } from '@/hooks/useTheme'
import { Monitor, Moon, Sun } from 'lucide-react'

export default function SettingsAccount() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useAuthStore()
  const toast = useToast()

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch('/auth/me'),
  })

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordResult, setPasswordResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameResult, setUsernameResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const { theme, setTheme } = useTheme()

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
      toast.error('密码验证失败', validation.error.errors[0].message)
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
      toast.success('密码已更新', '请使用新密码重新登录')
    } catch (err: any) {
      setPasswordResult({ ok: false, msg: err.message })
      toast.error('密码修改失败', err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleChangeUsername = async () => {
    setUsernameLoading(true)
    setUsernameResult(null)

    const validation = changeUsernameSchema.safeParse({
      newUsername,
      password: usernamePassword,
    })

    if (!validation.success) {
      const msg = validation.error.errors[0].message
      setUsernameResult({ ok: false, msg })
      setUsernameLoading(false)
      toast.error('用户名验证失败', msg)
      return
    }

    try {
      const result = await apiFetch('/auth/change-username', {
        method: 'POST',
        body: JSON.stringify({
          new_username: validation.data.newUsername,
          password: validation.data.password,
        }),
      })

      setUsernameResult({ ok: true, msg: '用户名修改成功' })
      setNewUsername('')
      setUsernamePassword('')
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('用户名已更新', `下次登录请使用新用户名：${(result as any).username}`)
    } catch (err: any) {
      setUsernameResult({ ok: false, msg: err.message })
      toast.error('用户名修改失败', err.message)
    } finally {
      setUsernameLoading(false)
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
      toast.success('配置已导出', '文件已保存到下载目录')
    } catch (err: any) {
      toast.error('导出失败', err.message || '未知错误')
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
      toast.success('配置已导入', `更新了 ${result.updated_fields.length} 个字段`)
    } catch (err: any) {
      setImportResult({
        ok: false,
        msg: '导入失败: ' + (err.message || '未知错误'),
      })
      toast.error('导入失败', err.message || '未知错误')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="修改用户名">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              当前用户名
            </label>
            <input
              type="text"
              value={String((currentUser as any)?.username ?? '')}
              disabled
              className="input opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              新用户名
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="input"
              placeholder="请输入新的登录用户名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              当前密码确认
            </label>
            <input
              type="password"
              value={usernamePassword}
              onChange={e => setUsernamePassword(e.target.value)}
              className="input"
            />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            修改后下次登录请使用新用户名，当前登录状态不会失效。
          </p>

          <button
            onClick={handleChangeUsername}
            disabled={!newUsername || !usernamePassword || usernameLoading}
            className="btn-primary w-full sm:w-auto"
          >
            {usernameLoading ? '保存中...' : '保存用户名'}
          </button>

          {usernameResult && (
            <p className={`text-sm ${usernameResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {usernameResult.ok ? (
                <>
                  <CheckCircle className="inline w-4 h-4 text-green-500 mr-1" />
                  用户名修改成功
                </>
              ) : (
                <>
                  <XCircle className="inline w-4 h-4 text-red-500 mr-1" />
                  {usernameResult.msg}
                </>
              )}
            </p>
          )}
        </div>
      </SectionCard>

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
          导出或导入全部配置，JSON 格式。导出文件不包含 .env。
          迁移服务器或恢复数据库时，请务必同时保留 ENCRYPTION_KEY，
          否则已保存的 Navidrome 密码等敏感配置将无法解密。
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

      <SectionCard title="外观设置">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {
              value: 'light',
              label: '日间模式',
              icon: Sun,
              desc: '始终使用浅色界面',
            },
            {
              value: 'dark',
              label: '黑夜模式',
              icon: Moon,
              desc: '始终使用深色界面',
            },
            {
              value: 'system',
              label: '跟随系统',
              icon: Monitor,
              desc: '根据设备系统自动切换',
            },
          ] as const).map(item => {
            const Icon = item.icon
            const active = theme === item.value

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTheme(item.value as ThemeMode)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-border bg-background hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {item.desc}
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}
