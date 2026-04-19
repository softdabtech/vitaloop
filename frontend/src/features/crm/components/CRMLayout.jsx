import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth.js'
import { useCRMRoleAccess } from '../../../hooks/useCRMRoleAccess.js'
import RoleBadge from './RoleBadge.jsx'
import '../../../styles/dashboard2026.css'

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
    <div className="vtl-shell min-h-screen text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-700/50 bg-slate-950/70 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-6">
            <div className="text-xl font-extrabold tracking-[0.08em]">VITALOOP CRM</div>
            <div className="mt-2"><RoleBadge role={role} /></div>
          </div>

          <nav className="grid gap-2">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => [
                  'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-200',
                ].join(' ')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="vtl-button-secondary mb-2 w-full text-sm"
            >
              Back to site
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="vtl-button-secondary mb-2 w-full text-sm"
            >
              User Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="w-full rounded-2xl border border-rose-500/45 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              Sign out
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            {user?.email || 'Unknown user'}
          </div>
        </aside>

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-5 border-b border-slate-700/50 pb-3">
            <h2 className="m-0 text-xl font-semibold tracking-tight text-slate-100">{title}</h2>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
