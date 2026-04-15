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
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Client ID</th>
              <th style={{ padding: 10, textAlign: 'left' }}>User ID</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Onboarding</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Subscription</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Practitioner</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((client) => (
              <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: 10 }}><code>{String(client.id).slice(0, 8)}...</code></td>
                <td style={{ padding: 10 }}><code>{String(client.user_id).slice(0, 8)}...</code></td>
                <td style={{ padding: 10 }}><StatusBadge status={client.onboarding_status} /></td>
                <td style={{ padding: 10 }}><code>{client.subscription_id ? String(client.subscription_id).slice(0, 8) + '...' : 'none'}</code></td>
                <td style={{ padding: 10 }}><code>{client.assigned_practitioner_id ? String(client.assigned_practitioner_id).slice(0, 8) + '...' : 'unassigned'}</code></td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <Link to={`/crm/clients/${client.id}`} style={{ background: '#1d9e75', color: '#fff', borderRadius: 8, padding: '6px 10px', textDecoration: 'none', fontSize: 13 }}>
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
