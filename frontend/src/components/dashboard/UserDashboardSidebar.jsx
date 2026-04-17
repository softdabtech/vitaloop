import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronLeft,
  Clock,
  FileText,
  Flame,
  Home,
  LogOut,
  Settings,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react'

const MENU_ITEMS = [
  { icon: Home,       label: 'Dashboard',     path: '/dashboard',   badge: null },
  { icon: Upload,     label: 'Upload Labs',   path: '/upload',      badge: null },
  { icon: FileText,   label: 'Lab Results',   path: '/lab-results', badge: null },
  { icon: Target,     label: 'Assignments',   path: '/assignments', badgeKey: 'pending_assignments' },
  { icon: TrendingUp, label: 'Progress',      path: '/progress',    badge: null },
  { icon: BarChart3,  label: 'Insights',      path: '/insights',    badge: null },
  { icon: Clock,      label: 'Check-ins',     path: '/check-ins',   badge: null },
  { icon: Flame,      label: 'Onboarding',    path: '/onboarding',  badge: null },
]

export default function UserDashboardSidebar({
  collapsed = false,
  onToggleCollapse,
  user,
  onLogout,
  mobile = false,
  onCloseMobile,
}) {
  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[280px]'

  return (
    <aside className={`${sidebarWidth} h-screen border-r border-slate-200 bg-white transition-[width] duration-300`}>
      <div className="flex h-[72px] items-center justify-between border-b border-slate-100 px-4">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25">
            <Activity className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-800">VITALOOP</div>
              <div className="text-xs text-slate-400">Health+</div>
            </div>
          )}
        </div>

        {!mobile && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="vtl-focus-ring rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <nav className="space-y-0.5 p-3">
        {MENU_ITEMS.map((item) => {
          const ItemIcon = item.icon
          const badgeValue = item.badgeKey ? Number(user?.[item.badgeKey] || 0) : item.badge

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={mobile ? onCloseMobile : undefined}
              className={({ isActive }) =>
                `group relative flex h-11 items-center gap-3 rounded-xl px-3 transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-emerald-500" />}
                  <ItemIcon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
                      {badgeValue > 0 && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25">
                          {badgeValue}
                        </span>
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-slate-100 p-3">
        <NavLink
          to="/settings"
          onClick={mobile ? onCloseMobile : undefined}
          className="group flex h-11 items-center gap-3 rounded-xl px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </NavLink>

        <button
          onClick={onLogout}
          className="group mt-0.5 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign out</span>}
        </button>

        {!collapsed && (
          <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="truncate text-xs font-medium text-slate-700">{user?.name || user?.email?.split('@')[0] || 'User'}</p>
            <p className="truncate text-xs text-slate-400">{user?.email || 'No email'}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
