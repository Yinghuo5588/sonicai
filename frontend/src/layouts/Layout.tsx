import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'

const navItems = [
  { to: '/', label: '仪表盘', icon: '📊' },
  { to: '/jobs', label: '任务执行', icon: '▶️' },
  { to: '/history', label: '推荐历史', icon: '📜' },
  { to: '/webhooks', label: 'Webhook', icon: '🔗' },
  { to: '/settings', label: '系统配置', icon: '⚙️' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">SonicAI</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
          >
            <span>🚪</span> 退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}