import { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import UserDashboardSidebar from './UserDashboardSidebar.jsx'
import MobileBottomBar from './MobileBottomBar.jsx'
import PWAInstallBanner from './PWAInstallBanner.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { isUkrainianLocale } from '../../lib/locale.js'
import { normalizePath, resolvePageMeta } from '../../lib/pathUtils.js'
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

export default function UserCabinetLayout({ children }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isUk = isUkrainianLocale()

  const normalizedPath = normalizePath(location.pathname)
  const pageMeta = useMemo(() => resolvePageMeta(normalizedPath, isUk), [normalizedPath, isUk])

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

      <div className="flex min-w-0 flex-1 flex-col vtl-topbar-standalone-pad">
        <main className="flex-1 overflow-x-hidden">
          <div className="vtl-cabinet-content mx-auto w-full max-w-6xl px-3 pt-7 sm:px-5 md:pb-8 lg:px-6">
            {location.pathname === '/dashboard' && <PWAInstallBanner />}
            {children}
          </div>
        </main>

        <MobileBottomBar />
      </div>
    </div>
  )
}
