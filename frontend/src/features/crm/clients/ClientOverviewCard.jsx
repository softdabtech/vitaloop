import StatusBadge from '../components/StatusBadge.jsx'

export default function ClientOverviewCard({ client }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Client Overview</h3>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
        <div><strong>Client ID:</strong> <code>{client?.id || '-'}</code></div>
        <div><strong>User ID:</strong> <code>{client?.user_id || '-'}</code></div>
        <div><strong>Onboarding:</strong> <StatusBadge status={client?.onboarding_status} /></div>
        <div><strong>Subscription ID:</strong> <code>{client?.subscription_id || 'none'}</code></div>
        <div><strong>Assigned Practitioner:</strong> <code>{client?.assigned_practitioner_id || 'unassigned'}</code></div>
        <div><strong>Active Program:</strong> <code>{client?.active_program_id || 'none'}</code></div>
      </div>
    </div>
  )
}
