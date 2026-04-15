import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth.js'
import { useCRMRoleAccess } from '../../../hooks/useCRMRoleAccess.js'
import RoleBadge from './RoleBadge.jsx'

const NAV_ITEMS = [
  { to: '/ops', label: 'Ops', roles: ['super_admin'] },
  { to: '/crm/programs', label: 'Programs', roles: ['super_admin', 'org_admin', 'practitioner'] },
  { to: '/crm/clients', label: 'Clients', roles: ['super_admin', 'org_admin', 'practitioner'] },
  { to: '/crm/practitioners', label: 'Practitioners', roles: ['super_admin', 'org_admin'] },
  { to: '/crm/activity', label: 'Activity', roles: ['super_admin', 'org_admin'] },
]

export default function CRMLayout({ title = 'CRM', children }) {
  const { signOut, user } = useAuth()
  const { role } = useCRMRoleAccess()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <div style={{ minHeight: '100vh', background: '#090d12', color: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
        <aside style={{ borderRight: '1px solid rgba(255,255,255,0.1)', padding: 20, background: 'linear-gradient(180deg, #0f1722, #0a1019)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>VITALOOP CRM</div>
            <div style={{ marginTop: 8 }}><RoleBadge role={role} /></div>
          </div>

          <nav style={{ display: 'grid', gap: 6 }}>
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  color: isActive ? '#8de9c9' : 'rgba(255,255,255,0.65)',
                  background: isActive ? 'rgba(29,158,117,0.2)' : 'transparent',
                  border: isActive ? '1px solid rgba(29,158,117,0.5)' : '1px solid transparent',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ marginTop: 22 }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ width: '100%', marginBottom: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
            >
              User Dashboard
            </button>
            <button
              onClick={handleSignOut}
              style={{ width: '100%', border: '1px solid rgba(255,120,120,0.4)', background: 'rgba(255,120,120,0.1)', color: '#ffb4b4', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>

          <div style={{ marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {user?.email || 'Unknown user'}
          </div>
        </aside>

        <main style={{ padding: 24 }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 20, paddingBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
