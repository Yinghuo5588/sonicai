import { Monitor, Moon, Sun } from 'lucide-react'
import { ThemeMode, useTheme } from '@/hooks/useTheme'
import { SectionCard } from './SettingsShared'

export default function SettingsAppearance() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-4">
      <SectionCard title="主题模式">
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
