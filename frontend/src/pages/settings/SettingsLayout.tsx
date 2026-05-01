import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Server,
  Radio,
  ListMusic,
  Clock,
  UserCog,
  Palette,
  Library,
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
    desc: '定时任务、热榜同步、歌单同步与缓存刷新',
    icon: Clock,
  },
  {
    key: 'library',
    title: '曲库索引',
    desc: '数据库曲库、别名索引与匹配日志',
    icon: Library,
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
      <div className="hidden md:block">
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle mt-1">
          管理服务连接、推荐策略、调度任务、外观和账户安全。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-6 items-start">

        {/* 侧边导航 */}
        <aside className="md:sticky md:top-6 space-y-3">
          {/* 移动端横向 Tab 栏（替代 select） */}
          <div className="md:hidden overflow-x-auto overscroll-x-contain -mx-4 px-4 pt-1 pb-1">
            <div className="flex gap-2 min-w-max">
              {SETTINGS_SECTIONS.map(item => {
                const Icon = item.icon
                const isActive = activeKey === item.key

                return (
                  <NavLink
                    key={item.key}
                    to={`/settings/${item.key}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.title}
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* 桌面端导航卡片 */}
          <div className="hidden md:block card overflow-hidden">
            <nav className="p-2 space-y-1">
              {SETTINGS_SECTIONS.map(item => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.key}
                    to={`/settings/${item.key}`}
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
        </main>
      </div>
    </div>
  )
}