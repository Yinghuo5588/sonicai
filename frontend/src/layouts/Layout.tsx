import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import apiFetch from '@/lib/api'

const navItems = [
  { to: '/', label: '仪表盘', icon: '📊' },
  { to: '/jobs', label: '任务执行', icon: '▶️' },
  { to: '/history', label: '推荐历史', icon: '📜' },
  { to: '/webhooks', label: 'Webhook', icon: '🔗' },
  { to: '/settings', label: '配置', icon: '⚙️' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch('/auth/me'),
    staleTime: 5 * 60 * 1000,
  })

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // 即使后端返回错误，客户端仍需退出
    }
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-48 bg-white border-r border-slate-200 flex-col fixed left-0 top-0 bottom-0 z-40">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">SonicAI</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          {user && (
            <div className="px-3 py-2 text-xs text-slate-400 truncate mb-1">
              👤 {(user as any).username}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            <span>🚪</span> 退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 min-h-screen pb-20 md:pb-0 md:ml-48">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-nav md:hidden">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `mobile-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button onClick={handleLogout} className="mobile-nav-item">
          <span className="text-lg">🚪</span>
          退出
        </button>
      </nav>
    </div>
  )
}
