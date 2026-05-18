import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Crown, LogOut, Menu } from 'lucide-react'
import UserDashboardSidebar from './UserDashboardSidebar.jsx'
import MobileBottomBar from './MobileBottomBar.jsx'
import PWAInstallBanner from './PWAInstallBanner.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useSubscription } from '../../hooks/useSubscription.js'
import { buildSubscriptionPath, getCabinetUpgradeTarget } from '../../lib/subscriptionFlow.js'
import '../../styles/dashboard2026.css'

const CRM_BASE_URL = (import.meta.env.VITE_CRM_BASE_URL || 'https://crm.vitaloop.today').replace(/\/$/, '')
const CRM_ROLES = new Set(['super_admin', 'admin', 'org_admin', 'org_owner', 'client_admin', 'manager', 'practitioner'])

function isCrmRole(user) {
  if (!user) return false
  const meta = user.user_metadata || {}
  const app = user.app_metadata || {}
  if (meta.is_super_admin || app.is_super_admin) return true
  const role = String(meta.global_role || app.global_role || meta.role || app.role || '').toLowerCase()
  return CRM_ROLES.has(role)
}

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: null },
  '/upload': { title: 'Upload Labs', subtitle: null },
  '/lab-results': { title: 'Lab Results', subtitle: null },
  '/assignments': { title: 'Assignments', subtitle: null },
  '/progress': { title: 'Progress', subtitle: null },
  '/insights': { title: 'Insights', subtitle: null },
  '/check-ins': { title: 'Check-ins', subtitle: null },
  '/onboarding': { title: 'Onboarding', subtitle: null },
  '/questionnaire': { title: 'Questionnaire', subtitle: null },
  '/settings': { title: 'Settings', subtitle: null },
}

function resolvePageMeta(pathname) {
  const direct = PAGE_META[pathname]
  if (direct) return direct
  if (pathname.startsWith('/results/')) return { title: 'Results', subtitle: null }
  if (pathname.startsWith('/protocol/')) return { title: 'Protocol', subtitle: null }
  if (pathname.startsWith('/assignments/')) return { title: 'Assignment', subtitle: null }
  return { title: 'Vitaloop', subtitle: null }
}

export default function UserCabinetLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { planName, loading: subLoading } = useSubscription()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const upgradeTarget = getCabinetUpgradeTarget(planName)

  const pageMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname])

  // CRM-role users (super_admin, practitioner, etc.) should not access the user cabinet
  useEffect(() => {
    if (user && isCrmRole(user)) {
      window.location.assign(CRM_BASE_URL)
    }
  }, [user])

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <div
      className="vtl-page flex min-h-[100svh] text-slate-900"
      style={{
        background: 'radial-gradient(circle at top left, rgba(var(--brand-rgb,29,158,117),0.1), transparent 20%), linear-gradient(180deg, #f8fafc 0%, #f3f7f5 100%)',
      }}
    >
      <div className="hidden md:sticky md:top-0 md:block md:self-start">
        <UserDashboardSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>
            <UserDashboardSidebar
              collapsed={false}
              mobile
              onCloseMobile={() => setSidebarOpen(false)}
              user={user}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur vtl-topbar-standalone-pad">
          <div className="mx-auto flex h-[60px] max-w-[1380px] items-center justify-between gap-4 px-3 sm:h-[72px] sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="vtl-focus-ring rounded-xl p-2 transition hover:bg-slate-100 md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5 text-slate-700" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{pageMeta.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {!subLoading && upgradeTarget && (
                <button
                  onClick={() => navigate(buildSubscriptionPath({ planId: upgradeTarget.planId, billingCycle: 'monthly' }))}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 sm:text-sm"
                >
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">{upgradeTarget.label}</span>
                  <span className="sm:hidden">Upgrade</span>
                </button>
              )}
              <a
                href="https://vitaloop.today"
                target="_blank"
                rel="noopener noreferrer"
                className="vtl-button-secondary inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm transition hover:bg-slate-200 hover:border-slate-400"
              >
                <span className="hidden sm:inline">Website</span>
                <span className="sm:hidden">↗</span>
              </a>
              <button
                onClick={handleLogout}
                className="vtl-button-secondary inline-flex shrink-0 items-center gap-2 px-3 text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1380px] px-3 py-5 pb-[calc(var(--vtl-bottom-bar-height)+20px)] sm:px-5 sm:py-7 md:pb-8 lg:px-6">
            {location.pathname === '/dashboard' && <PWAInstallBanner />}
            {children}
          </div>
        </main>

        <MobileBottomBar />
      </div>
    </div>
  )
}