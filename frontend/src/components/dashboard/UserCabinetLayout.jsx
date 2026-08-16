import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import toast from 'react-hot-toast'
import UserDashboardSidebar from './UserDashboardSidebar.jsx'
import MobileBottomBar from './MobileBottomBar.jsx'
import PWAInstallBanner from './PWAInstallBanner.jsx'
import UserAvatar from '../UserAvatar.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { isUkrainianLocale } from '../../lib/locale.js'
import '../../styles/dashboard2026.css'

const CRM_BASE_URL = (import.meta.env.VITE_CRM_BASE_URL || 'https://crm.vitaloop.today').replace(/\/$/, '')

const CRM_ROLES = new Set([
  'super_admin',
  'practitioner',
  'doctor',
  'nutritionist',
  'support',
  'admin',
  'crm',
])

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
  '/progress': { title: 'Progress', ukTitle: 'Прогрес', subtitle: null },
  '/insights': { title: 'Review', ukTitle: 'Огляд', subtitle: null },
  '/check-ins': { title: 'Check-in', ukTitle: 'Чек-ін', subtitle: null },
  '/onboarding': { title: 'Onboarding', ukTitle: 'Налаштування', subtitle: null },
  '/questionnaire': { title: 'Symptom Check', ukTitle: 'Перевірка симптомів', subtitle: null },
  '/health-profile': { title: 'Health Profile', ukTitle: 'Профіль здоров’я', subtitle: null },
  '/subscription': { title: 'Subscription', ukTitle: 'Підписка', subtitle: null },
  '/billing-history': { title: 'Billing History', ukTitle: 'Історія оплат', subtitle: null },
  '/settings': { title: 'Account', ukTitle: 'Акаунт', subtitle: null },
  '/help-center': { title: 'Help Center', ukTitle: 'Допомога', subtitle: null },
}

function resolvePageMeta(pathname, isUk = false) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const direct = PAGE_META[normalizedPath]
  if (direct) return { ...direct, title: isUk ? direct.ukTitle || direct.title : direct.title }
  if (normalizedPath.startsWith('/results/')) return { title: isUk ? 'Результати' : 'Results', subtitle: null }
  if (normalizedPath.startsWith('/protocol/')) return { title: isUk ? 'План дій' : 'Protocol', subtitle: null }
  if (normalizedPath.startsWith('/assignments/')) return { title: isUk ? 'Завдання' : 'Assignment', subtitle: null }
  return { title: 'Vitaloop', subtitle: null }
}

export default function UserCabinetLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isUk = isUkrainianLocale()

  const pageMeta = useMemo(() => resolvePageMeta(location.pathname, isUk), [location.pathname, isUk])
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/dashboard/'
  const siteHref = isUk ? 'https://ua.vitaloop.today' : 'https://vitaloop.today'
  const shellBackground = isUk
    ? 'radial-gradient(circle at top left, rgba(0, 87, 183, 0.13), transparent 24%), radial-gradient(circle at top right, rgba(255, 213, 0, 0.18), transparent 22%), linear-gradient(180deg, #f8fbff 0%, #eef6ff 48%, #fff9df 100%)'
    : 'radial-gradient(circle at top left, rgba(var(--brand-rgb,29,158,117),0.1), transparent 20%), linear-gradient(180deg, #f8fafc 0%, #f3f7f5 100%)'

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
      data-locale={isUk ? 'uk' : 'en'}
      style={{
        background: shellBackground,
      }}
    >
      <div className="hidden lg:sticky lg:top-0 lg:block lg:self-start">
        <UserDashboardSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}>
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
                className="vtl-focus-ring rounded-xl p-2 transition hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5 text-slate-700" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{pageMeta.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                <span className="hidden sm:inline">{isUk ? 'Сайт' : 'Website'}</span>
                <span className="sm:hidden">↗</span>
              </a>
              {/* Avatar → Settings shortcut */}
              <button
                onClick={() => navigate('/settings')}
                title={isUk ? 'Налаштування профілю' : 'Profile settings'}
                className="vtl-focus-ring rounded-full transition hover:opacity-80"
                style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <UserAvatar user={user} size={36} border />
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1380px] px-3 py-5 pb-[calc(var(--vtl-bottom-bar-height)+20px)] sm:px-5 sm:py-7 lg:px-6 lg:pb-8">
            {isDashboardRoute && <PWAInstallBanner />}
            {children}
          </div>
        </main>

        <MobileBottomBar />
      </div>
    </div>
  )
}
