import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, Crown, Home, LogOut, Menu, Settings, Upload } from 'lucide-react'
import UserDashboardSidebar from './UserDashboardSidebar.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { useSubscription } from '../../hooks/useSubscription.js'
import { PREMIUM_PRICE_LABEL } from '../../lib/pricing.js'
import '../../styles/dashboard2026.css'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your current health command center.' },
  '/upload': { title: 'Upload Labs', subtitle: 'Add a new report and unlock biomarkers, protocol, and trends.' },
  '/lab-results': { title: 'Lab Results', subtitle: 'Review upload history, examples, and biomarker signal quality.' },
  '/assignments': { title: 'Assignments', subtitle: 'Actionable tasks generated from onboarding, labs, and weekly signals.' },
  '/progress': { title: 'Progress', subtitle: 'Follow real changes between uploads and protocol cycles.' },
  '/insights': { title: 'Insights', subtitle: 'Understand what your data means and what you will unlock next.' },
  '/check-ins': { title: 'Check-ins', subtitle: 'Log weekly adherence, symptoms, and recovery signals.' },
  '/onboarding': { title: 'Onboarding', subtitle: 'Complete baseline health data for more accurate recommendations.' },
  '/questionnaire': { title: 'Questionnaire', subtitle: 'Adaptive health intake that feeds your personalized plan.' },
  '/settings': { title: 'Settings', subtitle: 'Manage profile, account preferences, and connected identities.' },
}

function resolvePageMeta(pathname) {
  const direct = PAGE_META[pathname]
  if (direct) return direct
  if (pathname.startsWith('/results/')) return { title: 'Results', subtitle: 'Detailed upload biomarkers and recommendation context.' }
  if (pathname.startsWith('/protocol/')) return { title: 'Protocol', subtitle: 'Structured nutrition, supplements, and lifestyle recommendations.' }
  if (pathname.startsWith('/assignments/')) return { title: 'Assignment Details', subtitle: 'A concrete task with context, urgency, and next action.' }
  return { title: 'Vitaloop Cabinet', subtitle: 'Personalized health workspace.' }
}

const MOBILE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/assignments', label: 'Tasks', icon: ClipboardList },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function isActivePath(currentPath, itemPath) {
  if (currentPath === itemPath) return true
  if (itemPath === '/dashboard') return currentPath === '/dashboard'
  return currentPath.startsWith(`${itemPath}/`)
}

export default function UserCabinetLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { isActive, loading: subLoading } = useSubscription()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const pageMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname])

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <div
      className="vtl-page flex min-h-screen text-slate-900"
      style={{
        background: 'radial-gradient(circle at top left, rgba(16,185,129,0.08), transparent 20%), linear-gradient(180deg, #f8fafc 0%, #f3f7f5 100%)',
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
        <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="mx-auto flex h-[74px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6">
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
                <p className="truncate text-xs text-slate-500 sm:text-sm">{pageMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {!subLoading && !isActive && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED', source: location.pathname } }))}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 sm:text-sm"
                >
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">Upgrade {PREMIUM_PRICE_LABEL}</span>
                  <span className="sm:hidden">Upgrade</span>
                </button>
              )}

              <button onClick={() => setSidebarCollapsed((prev) => !prev)} className="vtl-button-secondary hidden px-3 text-sm md:inline-flex">
                {sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              </button>

              <button
                onClick={handleLogout}
                className="vtl-button-secondary inline-flex items-center gap-2 px-3 text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8">
            {children}
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-3 py-2 backdrop-blur md:hidden">
          <div className="grid grid-cols-5 gap-2">
            {MOBILE_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = isActivePath(location.pathname, item.path)

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}