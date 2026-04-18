import { useNavigate, useLocation, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { ArrowLeft, LogOut, LayoutDashboard, Users, Settings, BarChart3 } from 'lucide-react'

const CLIENT_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard', label: 'My Health', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const OPS_NAV = [
  { to: '/ops', label: 'Overview', icon: BarChart3 },
  { to: '/ops?tab=users', label: 'Users', icon: Users },
  { to: '/ops?tab=knowledge', label: 'Knowledge', icon: Settings },
]

export default function AdminShell({ title, subtitle, children, variant = 'client' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const navItems = variant === 'ops' ? OPS_NAV : CLIENT_NAV

  function isOpsTabActive(target) {
    if (variant !== 'ops') return false

    const [targetPath, targetQuery = ''] = target.split('?')
    if (location.pathname !== targetPath) return false

    const currentTab = new URLSearchParams(location.search).get('tab') || 'overview'
    const targetTab = new URLSearchParams(targetQuery).get('tab') || 'overview'
    return currentTab === targetTab
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(15,23,42,0.12)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.62)', fontSize: 14, fontWeight: 500, padding: '6px 0', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(15,23,42,0.62)'}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(15,23,42,0.12)' }} />

        {/* Title / breadcrumb */}
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.5)', marginLeft: 10 }}>{subtitle}</span>}
        </div>

        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.62)', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = 'rgba(15,23,42,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(15,23,42,0.62)'; e.currentTarget.style.background = 'none' }}
        >
          Site
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.55)', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff4d4d'; e.currentTarget.style.background = 'rgba(255,77,77,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(15,23,42,0.55)'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      {/* Sub-nav */}
      <div style={{ borderBottom: '0.5px solid rgba(15,23,42,0.1)', padding: '0 24px', display: 'flex', gap: 4 }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            style={({ isActive }) => {
              const active = variant === 'ops' ? isOpsTabActive(to) : isActive
              return {
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              fontSize: 13, fontWeight: 500,
              color: active ? '#1d9e75' : 'rgba(15,23,42,0.58)',
              borderBottom: active ? '2px solid #1d9e75' : '2px solid transparent',
              textDecoration: 'none', transition: 'color 0.2s',
              marginBottom: -1,
            }
            }}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </div>
    </div>
  )
}
