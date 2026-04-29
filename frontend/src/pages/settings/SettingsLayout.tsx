import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Server,
  Radio,
  ListMusic,
  Clock,
  UserCog,
  Palette,
  Database,
} from 'lucide-react'

const SETTINGS_SECTIONS = [
  {
    key: 'connections',
    title: '服务连接',
    desc: 'Last.fm、Navidrome、Webhook 与歌单解析服务',
    icon: Server,
  },
  {
    key: 'source',
    title: '推荐源',
    desc: 'Last.fm 抓取策略与种子来源',
    icon: Radio,
  },
  {
    key: 'playlist',
    title: '歌单匹配',
    desc: 'Navidrome 生成、匹配与推荐控制',
    icon: ListMusic,
  },
  {
    key: 'schedule',
    title: '调度设置',
    desc: '定时任务、热榜同步与歌单同步',
    icon: Clock,
  },
  {
    key: 'cache',
    title: '歌曲缓存',
    desc: '缓存 Navidrome 曲库，加速匹配',
    icon: Database,
  },
  {
    key: 'account',
    title: '账户与备份',
    desc: '修改密码、退出登录、配置导入导出',
    icon: UserCog,
  },
  {
    key: 'appearance',
    title: '外观设置',
    desc: '主题模式与显示偏好',
    icon: Palette,
  },
] as const

export default function SettingsLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = location.pathname.split('/').filter(Boolean)[1] || 'connections'
  const activeSection =
    SETTINGS_SECTIONS.find(item => item.key === activeKey) || SETTINGS_SECTIONS[0]

  return (
    <div className="page">
      <div>
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle mt-1">
          管理服务连接、推荐策略、调度任务、外观和账户安全。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 md:gap-6 items-start">
        <aside className="md:sticky md:top-6 space-y-3">
          <div className="card card-padding md:hidden">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              当前设置页面
            </label>
            <select
              value={activeSection.key}
              onChange={e => navigate(`/settings/${e.target.value}`)}
              className="select"
            >
              {SETTINGS_SECTIONS.map(item => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="md:hidden overflow-x-auto overscroll-x-contain p-2">
              <div className="flex gap-2 min-w-max">
                {SETTINGS_SECTIONS.map(item => {
                  const Icon = item.icon

                  return (
                    <NavLink
                      key={item.key}
                      to={`/settings/${item.key}`}
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {item.title}
                    </NavLink>
                  )
                })}
              </div>
            </div>

            <nav className="hidden md:block p-2">
              {SETTINGS_SECTIONS.map(item => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.key}
                    to={`/settings/${item.key}`}
                    className={({ isActive }) =>
                      `flex items-start gap-3 rounded-2xl px-4 py-3 transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="block text-xs opacity-70 mt-0.5">{item.desc}</span>
                    </span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="card card-padding">
            <div className="flex items-start gap-3">
              <activeSection.icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {activeSection.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeSection.desc}
                </p>
              </div>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  )
}
