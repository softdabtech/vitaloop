import StatusBadge from '../components/StatusBadge.jsx'

export default function ClientOverviewCard({ client }) {
  return (
    <div className="vtl-card rounded-2xl p-4">
      <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Client Overview</h3>
      <div className="grid gap-2 text-sm text-slate-300">
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
