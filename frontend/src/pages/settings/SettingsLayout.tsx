import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Server,
  Radio,
  ListMusic,
  Clock,
  UserCog,
  Library,
} from 'lucide-react'

const SETTINGS_SECTIONS = [
  {
    key: 'connections',
    title: '服务连接',
    desc: 'Last.fm、Navidrome、Webhook 与歌单解析服务',
    icon: Server,
    to: '/settings/connections',
  },
  {
    key: 'recommendation',
    title: '推荐策略',
    desc: '种子来源、推荐规模、匹配阈值与去重策略',
    icon: Radio,
    to: '/settings/source',
  },
  {
    key: 'playlist',
    title: '歌单匹配',
    desc: 'Navidrome 生成、匹配与推荐控制',
    icon: ListMusic,
    to: '/settings/playlist',
  },
  {
    key: 'library',
    title: '曲库调试',
    desc: '曲库索引、缓存、未命中歌曲、人工匹配与诊断',
    icon: Library,
    to: '/settings/library',
  },
  {
    key: 'automation',
    title: '自动化任务',
    desc: '定时推荐、热榜同步、歌单同步、清理策略',
    icon: Clock,
    to: '/settings/schedule',
  },
  {
    key: 'system',
    title: '账户与系统',
    desc: '账户安全、配置备份与外观设置',
    icon: UserCog,
    to: '/settings/account',
  },
  ] as const

export default function SettingsLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const rawPath = location.pathname
  const isSettingsRoot = rawPath === '/settings' || rawPath === '/settings/'
  const activeKey = isSettingsRoot
    ? 'connections'
    : rawPath.split('/').filter(Boolean)[1] || 'connections'
  const activeSection =
    SETTINGS_SECTIONS.find(item => item.key === activeKey) || SETTINGS_SECTIONS[0]

  return (
    <div className="page">
      {/* 移动端设置首页卡片 */}
      {isSettingsRoot && (
        <div className="md:hidden space-y-3">
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">
            选择一个设置分类进行配置。
          </p>

          <div className="grid grid-cols-1 gap-3">
            {SETTINGS_SECTIONS.map(item => {
              const Icon = item.icon

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="card card-padding flex items-start gap-3 text-left active:scale-[0.99] transition"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">
                    <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-6 items-start">

        {/* 侧边导航 */}
        <aside className="md:sticky md:top-6 space-y-3">
          {/* 桌面端导航卡片 */}
          <div className="hidden md:block card overflow-hidden">
            <nav className="p-2 space-y-1">
              {SETTINGS_SECTIONS.map(item => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-start gap-3 px-4 py-3 rounded-2xl transition-all relative ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-7 before:bg-cyan-500 before:rounded-r-full'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/50'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="block text-[11px] opacity-70 mt-0.5">{item.desc}</span>
                    </span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* 内容区 */}
        <main className="min-w-0 space-y-4">
          {!isSettingsRoot && (
            <>
              <div className="hidden md:block card card-padding">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <activeSection.icon className="w-5 h-5 text-cyan-600 dark:text-cyan-300 mt-1" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                      {activeSection.title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeSection.desc}
                    </p>
                  </div>
                </div>
              </div>

              <Outlet />
            </>
          )}
        </main>
      </div>
    </div>
  )
}