import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronLeft,
  Clock,
  CreditCard,
  Crown,
  FileText,
  Flame,
  Home,
  Lock,
  LogOut,
  Settings,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { useSubscription } from '../../hooks/useSubscription.js'
import { PREMIUM_PRICE_LABEL } from '../../lib/pricing.js'

const MENU_ITEMS = [
  { icon: Home,       label: 'Dashboard',     path: '/dashboard',   badge: null },
  { icon: Upload,     label: 'Upload Labs',   path: '/upload',      badge: null },
  { icon: FileText,   label: 'Lab Results',   path: '/lab-results', badge: null },
  { icon: Target,     label: 'Assignments',   path: '/assignments', badgeKey: 'pending_assignments', premium: true },
  { icon: TrendingUp, label: 'Progress',      path: '/progress',    badge: null, premium: true },
  { icon: BarChart3,  label: 'Health Insights', path: '/insights',  badge: null, premium: true },
  { icon: Clock,      label: 'Weekly Check-in', path: '/check-ins', badge: null, premium: true },
  { icon: Flame,      label: 'Health Profile',  path: '/health-profile', badge: null },
  { icon: CreditCard, label: 'Subscription',    path: '/subscription', badge: null },
]

function isItemActive(currentPath, itemPath) {
  if (itemPath === '/lab-results') {
    return currentPath === '/lab-results' || currentPath.startsWith('/results/') || currentPath.startsWith('/protocol/')
  }
  if (itemPath === '/assignments') {
    return currentPath === '/assignments' || currentPath.startsWith('/assignments/')
  }
  if (itemPath === '/check-ins') {
    return currentPath === '/check-ins' || currentPath === '/checkin'
  }
  if (itemPath === '/settings' || itemPath === '/health-profile' || itemPath === '/subscription') {
    return currentPath === itemPath
  }
  if (itemPath === '/dashboard') {
    return currentPath === '/dashboard'
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export default function UserDashboardSidebar({
  collapsed = false,
  onToggleCollapse,
  user,
  onLogout,
  mobile = false,
  onCloseMobile,
}) {
  const location = useLocation()
  const { isActive: hasPremium, loading: subscriptionLoading } = useSubscription()
  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[280px]'
  const visibleItems = MENU_ITEMS

  function handleLockedFeature(item) {
    if (!item.premium || subscriptionLoading || hasPremium) return

    window.dispatchEvent(new CustomEvent('paywall:trigger', {
      detail: {
        reason: 'SUBSCRIPTION_REQUIRED',
        feature: item.label,
        source: item.path,
      },
    }))
  }

  return (
    <aside className={`${sidebarWidth} flex h-screen flex-col border-r border-slate-200 bg-white transition-[width] duration-300`}>
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

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ visibility: collapsed ? 'visible' : (!mobile ? 'visible' : 'hidden') }}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const ItemIcon = item.icon
          const badgeValue = item.badgeKey ? Number(user?.[item.badgeKey] || 0) : item.badge
          const active = isItemActive(location.pathname, item.path)
          // Показываем premium-метки только после окончания загрузки
          const isLocked = item.premium && !subscriptionLoading && !hasPremium

          const navElement = (
            <div className={`group relative flex h-11 items-center gap-3 rounded-xl px-3 transition ${
              isLocked ? 'opacity-50 cursor-not-allowed' : active
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}>
              {active && !isLocked && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-emerald-500" />}
              <ItemIcon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {isLocked && !subscriptionLoading ? (
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                  ) : (
                    badgeValue > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25">
                        {badgeValue}
                      </span>
                    )
                  )}
                </>
              )}
            </div>
          )

          return (
            <div key={item.path}>
              {isLocked ? (
                <button
                  onClick={() => {
                    handleLockedFeature(item)
                  }}
                  className="w-full text-left"
                >
                  {navElement}
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={() => {
                    if (mobile) {
                      onCloseMobile?.()
                    }
                  }}
                  className="w-full"
                >
                  {navElement}
                </NavLink>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        {!collapsed && !subscriptionLoading && !hasPremium && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED', source: 'sidebar-upgrade' } }))}
            className="mb-2 w-full rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-3 text-left transition hover:border-amber-300 hover:shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Premium access</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">Unlock protocols, trends, and check-ins</div>
            <div className="mt-1 text-xs text-slate-500">{PREMIUM_PRICE_LABEL}</div>
          </button>
        )}

        <NavLink
          to="/settings"
          onClick={mobile ? onCloseMobile : undefined}
          className="group flex h-11 items-center gap-3 rounded-xl px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Account</span>}
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
