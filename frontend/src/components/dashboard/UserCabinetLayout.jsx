import { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import toast from 'react-hot-toast'
import UserDashboardSidebar from './UserDashboardSidebar.jsx'
import MobileBottomBar from './MobileBottomBar.jsx'
import PWAInstallBanner from './PWAInstallBanner.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { isUkrainianLocale } from '../../lib/locale.js'
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
  '/dashboard': { title: 'Today', ukTitle: 'Сьогодні', subtitle: null },
  '/upload': { title: 'Upload Results', ukTitle: 'Завантажити аналізи', subtitle: null },
  '/lab-plan': { title: 'Lab Plan', ukTitle: 'План аналізів', subtitle: null },
  '/lab-results': { title: 'Results & Trends', ukTitle: 'Результати й динаміка', subtitle: null },
  '/assignments': { title: 'Protocol', ukTitle: 'План дій', subtitle: null },
  '/progress': { title: 'Results & Trends', ukTitle: 'Результати й динаміка', subtitle: null },
  '/insights': { title: 'Review', ukTitle: 'Огляд', subtitle: null },
  '/check-ins': { title: 'Check-in', ukTitle: 'Чек-ін', subtitle: null },
  '/onboarding': { title: 'Onboarding', ukTitle: 'Налаштування', subtitle: null },
  '/questionnaire': { title: 'Symptom Check', ukTitle: 'Перевірка симптомів', subtitle: null },
  '/settings': { title: 'Account', ukTitle: 'Акаунт', subtitle: null },
  '/help-center': { title: 'Help Center', ukTitle: 'Допомога', subtitle: null },
}

function resolvePageMeta(pathname, isUk = false) {
  const direct = PAGE_META[pathname]
  if (direct) return { ...direct, title: isUk ? direct.ukTitle || direct.title : direct.title }
  if (pathname.startsWith('/results/')) return { title: isUk ? 'Результати' : 'Results', subtitle: null }
  if (pathname.startsWith('/protocol/')) return { title: isUk ? 'План дій' : 'Protocol', subtitle: null }
  if (pathname.startsWith('/assignments/')) return { title: isUk ? 'Завдання' : 'Assignment', subtitle: null }
  return { title: 'Vitaloop', subtitle: null }
}

export default function UserCabinetLayout({ children }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isUk = isUkrainianLocale()

  const pageMeta = useMemo(() => resolvePageMeta(location.pathname, isUk), [location.pathname, isUk])

  useEffect(() => {
    document.title = `${pageMeta.title} | VITALOOP`
  }, [pageMeta.title])

  // CRM-role users (super_admin, practitioner, etc.) should not access the user cabinet
  useEffect(() => {
    if (!user || !isCrmRole(user)) {
      return undefined
    }

    toast.loading('Redirecting to CRM dashboard...', {
      duration: 1200,
    })

    const redirectTimer = window.setTimeout(() => {
      window.location.assign(CRM_BASE_URL)
    }, 350)

    return () => window.clearTimeout(redirectTimer)
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

      <div className="flex min-w-0 flex-1 flex-col vtl-topbar-standalone-pad">
        {/* The sticky title/Website/Sign-out/avatar bar that used to live here was
            removed per explicit request — it duplicated controls already present
            in the sidebar (Sign out, avatar → Settings) and just ate vertical
            space on every page. `vtl-topbar-standalone-pad` (PWA status-bar
            safe-area padding) moved up onto this wrapper so installed-PWA users
            on notched phones don't lose that inset now that there's no bar to
            carry it. The mobile sidebar still needs a way to open without that
            bar's hamburger button — this floating icon-only button is the
            minimum replacement, not a header. */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="vtl-focus-ring fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

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
