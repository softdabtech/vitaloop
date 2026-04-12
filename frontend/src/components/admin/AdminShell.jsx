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
  const { signOut } = useAuth()
  const navItems = variant === 'ops' ? OPS_NAV : CLIENT_NAV

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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, padding: '6px 0', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        {/* Title / breadcrumb */}
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>{subtitle}</span>}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff4d4d'; e.currentTarget.style.background = 'rgba(255,77,77,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      {/* Sub-nav */}
      <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '0 24px', display: 'flex', gap: 4 }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              fontSize: 13, fontWeight: 500,
              color: isActive ? '#1d9e75' : 'rgba(255,255,255,0.45)',
              borderBottom: isActive ? '2px solid #1d9e75' : '2px solid transparent',
              textDecoration: 'none', transition: 'color 0.2s',
              marginBottom: -1,
            })}
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
