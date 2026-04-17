import { Link } from 'react-router-dom'
import CRMTableState from '../components/CRMTableState.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function ClientList({ loading, error, clients, onRetry }) {
  const items = clients || []

  return (
    <CRMTableState
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items.length}
      emptyTitle="No clients yet"
      emptyDescription="Clients will appear after onboarding or manual creation in CRM backend."
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/40">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-400">
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Client ID</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">User ID</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Onboarding</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Subscription</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Practitioner</th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((client) => (
              <tr key={client.id} className="border-b border-slate-800/80 text-sm text-slate-200">
                <td className="p-3"><code className="text-slate-200">{String(client.id).slice(0, 8)}...</code></td>
                <td className="p-3"><code className="text-slate-300">{String(client.user_id).slice(0, 8)}...</code></td>
                <td className="p-3"><StatusBadge status={client.onboarding_status} /></td>
                <td className="p-3"><code className="text-slate-300">{client.subscription_id ? String(client.subscription_id).slice(0, 8) + '...' : 'none'}</code></td>
                <td className="p-3"><code className="text-slate-300">{client.assigned_practitioner_id ? String(client.assigned_practitioner_id).slice(0, 8) + '...' : 'unassigned'}</code></td>
                <td className="p-3 text-right">
                  <Link to={`/crm/clients/${client.id}`} className="vtl-button-primary inline-flex min-h-[34px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold no-underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CRMTableState>
  )
}
