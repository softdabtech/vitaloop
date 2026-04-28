import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const BREADCRUMB_NAMES = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload',
  '/results': 'Results',
  '/settings': 'Settings',
  '/insights': 'Insights',
  '/assignments': 'Tasks',
  '/progress': 'Progress',
  '/onboarding': 'Onboarding',
}

export default function Breadcrumb() {
  const { pathname } = useLocation()

  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs = [
    { label: 'Home', href: '/dashboard', icon: true },
    ...segments.map((segment, idx) => ({
      label: BREADCRUMB_NAMES[`/${segments.slice(0, idx + 1).join('/')}`] || segment,
      href: `/${segments.slice(0, idx + 1).join('/')}`,
    })),
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '0 0 16px 0',
      fontSize: '13px',
      color: '#64748b',
    }}>
      {breadcrumbs.map((crumb, idx) => (
        <div key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {idx > 0 && <ChevronRight size={16} style={{ color: '#cbd5e1' }} />}

          {idx === breadcrumbs.length - 1 ? (
            <span style={{ color: '#475569', fontWeight: 500 }}>
              {crumb.icon ? <Home size={14} /> : crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.href}
              style={{
                color: '#64748b',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {crumb.icon ? <Home size={14} /> : crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
