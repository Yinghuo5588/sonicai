import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Play,
  ScrollText,
  Link2,
  Settings,
} from 'lucide-react'
import loginLogo from '@/assets/login-logo.png'

const navItems = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard },
  { to: '/jobs', label: '任务执行', icon: Play },
  { to: '/history', label: '推荐历史', icon: ScrollText },
  { to: '/webhooks', label: 'Webhook', icon: Link2 },
  { to: '/settings', label: '设置', icon: Settings },
]

export default function Layout() {
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch('/auth/me'),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar - 半透明控制台侧栏 */}
      <aside className="hidden md:flex w-64 bg-card/80 backdrop-blur-xl border-r border-border/70 flex-col fixed left-0 top-0 bottom-0 z-40">
        {/* Logo 区 */}
        <div className="p-5 border-b border-border/70">
          <img src={loginLogo} alt="SonicAI" className="h-12 w-auto" />
        </div>

        {/* 导航区 - 左侧光条 active 状态 */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative',
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 shadow-sm before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-cyan-500 before:rounded-r-full'
                    : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/50'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* 用户信息区 - 小卡片 */}
        {user && (
          <div className="p-4 border-t border-border/70">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {((user as any).username || 'U')[0].toUpperCase()}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium">
                {(user as any).username}
              </span>
            </div>
          </div>
        )}
      </aside>

      <main className="min-h-screen pb-20 md:pb-0 md:ml-64">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar - 胶囊 active 背景 */}
      <nav className="mobile-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => clsx('mobile-nav-item', { active: isActive })}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
