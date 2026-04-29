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
  User,
  Music2,
} from 'lucide-react'

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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-card border-r border-border flex-col fixed left-0 top-0 bottom-0 z-40">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">SonicAI</h1>
              <p className="text-xs text-slate-400">Music Recommender</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {(user as any).username}
              </span>
            </div>
          </div>
        )}
      </aside>

      <main className="min-h-screen pb-20 md:pb-0 md:ml-56">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
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
