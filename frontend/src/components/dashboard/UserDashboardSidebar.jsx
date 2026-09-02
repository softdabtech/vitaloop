import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ChevronLeft,
  CreditCard,
  Crown,
  FileText,
  Flame,
  HelpCircle,
  Home,
  Route,
  Lock,
  LogOut,
  Settings,
  Target,
  Upload,
  User,
} from 'lucide-react'
import { useSubscription } from '../../hooks/useSubscription.js'
import { buildSubscriptionPath, getCabinetUpgradeTarget } from '../../lib/subscriptionFlow.js'
import { isUkrainianLocale } from '../../lib/locale.js'
import UserAvatar from '../UserAvatar.jsx'

const MENU_ITEMS = [
  { icon: Home, label: 'Today', ukLabel: 'Сьогодні', path: '/dashboard', badge: null },
  // Structural merge: the former separate "Check-in" nav item (premium-gated,
  // path: '/check-ins') now lives inside this same page — Questionnaire.jsx
  // shows the full intake wizard or the short weekly pulse depending on
  // whether the user already has an active concern and is due for one.
  { icon: Target, label: 'Symptom Check', ukLabel: 'Симптоми', path: '/questionnaire', badge: null },
  { icon: Route, label: 'Lab Plan', ukLabel: 'План аналізів', path: '/lab-plan', badge: null },
  { icon: Upload, label: 'Upload Results', ukLabel: 'Завантажити', path: '/upload', badge: null },
  { icon: FileText, label: 'Results & Trends', ukLabel: 'Результати', path: '/lab-results', badge: null },
  // "Protocol" -> /assignments removed intentionally, not by accident: that
  // route shows tasks a human practitioner/coach assigned via the CRM, not
  // the user's own AI-generated protocol (which lives at /protocol/:uploadId,
  // reached from Results). Every current self-serve end_user has zero
  // practitioner_assignments rows, so this nav item was a permanent dead end
  // labeled with the one word ("Protocol") users most want. Re-add only when
  // the product actually has a coached/practitioner-attached user tier — see
  // the matching note on the /assignments route in App.jsx.
  { icon: Flame, label: 'Profile & Safety', ukLabel: 'Профіль і безпека', path: '/health-profile', badge: null },
  { icon: CreditCard, label: 'Billing', ukLabel: 'Оплата', path: '/subscription', badge: null },
  { icon: Settings, label: 'Account', ukLabel: 'Акаунт', path: '/settings', badge: null },
  { icon: HelpCircle, label: 'Help Center', ukLabel: 'Допомога', path: '/help-center', badge: null },
]

function isItemActive(currentPath, itemPath) {
  if (itemPath === '/lab-results') {
    return currentPath === '/lab-results' || currentPath === '/progress' || currentPath.startsWith('/results/') || currentPath.startsWith('/protocol/')
  }
  if (itemPath === '/questionnaire') {
    return currentPath === '/questionnaire'
  }
  if (itemPath === '/lab-plan') {
    return currentPath === '/lab-plan'
  }
  if (itemPath === '/assignments') {
    return currentPath === '/assignments' || currentPath.startsWith('/assignments/')
  }
  if (itemPath === '/check-ins') {
    return currentPath === '/check-ins' || currentPath === '/checkin'
  }
  if (itemPath === '/settings' || itemPath === '/health-profile' || itemPath === '/subscription' || itemPath === '/upload') {
    return currentPath === itemPath
  }
  if (itemPath === '/dashboard') {
    return currentPath === '/dashboard'
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

function triggerPaywall(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail }))
  }
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
  const { isActive: hasPremium, loading: subscriptionLoading, planName } = useSubscription()
  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[280px]'
  const visibleItems = MENU_ITEMS
  const upgradeTarget = hasPremium ? null : getCabinetUpgradeTarget(planName, hasPremium)
  const isUk = isUkrainianLocale()

  function handleLockedFeature(item) {
    if (!item.premium || subscriptionLoading || hasPremium) return

    triggerPaywall({
      reason: 'SUBSCRIPTION_REQUIRED',
      feature: item.label,
      source: item.path,
    })
  }

  return (
    <aside className={`${sidebarWidth} flex h-screen flex-col border-r border-slate-200 bg-white transition-[width] duration-300`}>
      {/* Collapsed width is 72px, minus 2x16px padding = 40px of content width —
          exactly one 40px logo box and nothing else. The logo + toggle button
          used to sit side-by-side in that same row and fight over that 40px,
          which squeezed the toggle button down to an invisible/unclickable
          sliver (the empty box reported in production). Collapsed state now
          stacks them vertically instead, so both get their own full-width row. */}
      <div className={`flex border-b border-slate-100 ${collapsed ? 'flex-col items-center gap-2 py-3' : 'h-[72px] items-center justify-between px-4'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
            <img src="/images/favicon_1.png" alt="VITALOOP" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-800">VITALOOP</div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
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
                  <span className="flex-1 text-sm font-medium">{isUk ? item.ukLabel || item.label : item.label}</span>
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
        {!collapsed && !subscriptionLoading && upgradeTarget && (
          <button
            onClick={() => window.location.assign(buildSubscriptionPath({ planId: upgradeTarget.planId, billingCycle: 'monthly' }))}
            className="mb-2 w-full rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-3 text-left transition hover:border-amber-300 hover:shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">{isUk ? 'Преміум доступ' : 'Premium access'}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{upgradeTarget.label}</div>
            <div className="mt-1 text-xs text-slate-500">{isUk ? 'Перейти до преміум доступу' : 'Continue to Premium access'}</div>
          </button>
        )}

        <button
          onClick={onLogout}
          className="group mt-0.5 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{isUk ? 'Вийти' : 'Sign out'}</span>}
        </button>

        {/* User profile card */}
        <div
          className="relative mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-100"
          onClick={() => { if (typeof window !== 'undefined') window.location.href = '/settings' }}
          title={isUk ? 'Налаштування профілю' : 'Profile settings'}
        >
          <div className="flex items-start gap-2.5">
            <UserAvatar user={user} size={collapsed ? 32 : 36} />
            {!collapsed && (
              <div className="min-w-0 flex-1 pr-5">
                <p className="truncate text-xs font-semibold text-slate-700">
                  {user?.user_metadata?.full_name || user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="truncate text-xs text-slate-400">{user?.email || (isUk ? 'Email не вказано' : 'No email')}</p>
              </div>
            )}
            {!collapsed && <Settings className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-300" />}
          </div>
        </div>
      </div>
    </aside>
  )
}
